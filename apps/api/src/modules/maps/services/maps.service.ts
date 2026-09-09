import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@googlemaps/google-maps-services-js';
import { RedisService } from '../../../shared/redis/redis.service';
import { PlaceResult, RouteResult } from '../interfaces/place-result.interface';
import { ValhallaRoutingService } from './valhalla-routing.service';

// Google Places API (New) response types - internal use only
interface GoogleNewPlacesResponse {
  places?: Array<{
    id: string;
    displayName: { text: string; languageCode: string };
    formattedAddress: string;
    location: { latitude: number; longitude: number };
    types?: string[];
  }>;
}

// Note: GoogleGeocodeResponse interface removed as it's not needed with @googlemaps/google-maps-services-js client

@Injectable()
export class MapsService {
  private readonly logger = new Logger(MapsService.name);
  private client: Client;
  private apiKey: string;

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
    private readonly valhallaRoutingService: ValhallaRoutingService,
  ) {
    this.client = new Client({});
    this.apiKey = this.configService.getOrThrow<string>('maps.apiKey');
  }

  /**
   * Search for places using Google Places API (New)
   * @param query Search query text
   * @param lat Optional latitude for location bias
   * @param lng Optional longitude for location bias
   */
  async searchPlaces(
    query: string,
    lat?: number,
    lng?: number,
    regionCode?: string,
  ): Promise<PlaceResult[]> {
    // Resolve region defensively: prefer a valid client value, else fall back
    // to the config default. A bad/empty regionCode must never break search.
    const configuredFallback = this.configService.get<string>(
      'maps.defaultRegionCode',
      'KE',
    );
    // The config default comes from unvalidated env, so validate it too and
    // fall back to a hardcoded valid region if it is malformed.
    const fallbackRegion = /^[A-Z]{2}$/.test(configuredFallback)
      ? configuredFallback
      : 'KE';
    const region =
      regionCode && /^[A-Z]{2}$/.test(regionCode) ? regionCode : fallbackRegion;

    // Build cache key with 2dp precision for search (Watchout 3)
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, '_');
    const latStr = lat !== undefined ? lat.toFixed(2) : '';
    const lngStr = lng !== undefined ? lng.toFixed(2) : '';
    const locationSuffix =
      lat !== undefined && lng !== undefined ? `:${latStr}:${lngStr}` : '';
    // Namespace by region so a region change can't serve stale cross-region results
    const cacheKey = `maps:search:${region}:${normalizedQuery}${locationSuffix}`;

    // Check Redis cache first
    const redisClient = this.redisService.getClient();
    const cachedResult = await redisClient.get(cacheKey);

    if (cachedResult) {
      this.logger.debug(`[Maps] Cache hit: ${cacheKey}`);
      return JSON.parse(cachedResult) as PlaceResult[];
    }

    this.logger.debug(`[Maps] Cache miss — calling Google: ${cacheKey}`);

    // Prepare request body for Google Places API (New)
    interface GooglePlacesRequest {
      textQuery: string;
      pageSize: number;
      languageCode: string;
      regionCode: string;
      locationBias?: {
        circle: {
          center: { latitude: number; longitude: number };
          radius: number;
        };
      };
    }

    const requestBody: GooglePlacesRequest = {
      textQuery: query,
      pageSize: 5,
      languageCode: 'en',
      regionCode: region,
    };

    // Add location bias if coordinates provided
    if (lat !== undefined && lng !== undefined) {
      requestBody.locationBias = {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 50000.0, // 50km radius
        },
      };
    }

    const timeoutMs = this.configService.get<number>(
      'maps.requestTimeoutMs',
      8000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Call Google Places API (New) - POST request (Watchout 4)
      const response = await fetch(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask':
              'places.id,places.displayName,places.formattedAddress,places.location,places.types',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `Google Places API error: ${response.status} - ${errorBody}`,
        );
        throw new BadGatewayException(
          'Google Places API request failed',
          'UPSTREAM_PLACES_ERROR',
        );
      }

      const data = (await response.json()) as GoogleNewPlacesResponse;

      // Normalize to PlaceResult[] (Watchout 5 - different field names)
      const results: PlaceResult[] = (data.places ?? []).map((place) => ({
        placeId: place.id,
        displayName: place.displayName.text,
        address: place.formattedAddress,
        lat: place.location.latitude,
        lng: place.location.longitude,
        types: place.types ?? [],
      }));

      // Cache result with 7 day TTL
      const ttlSeconds = 60 * 60 * 24 * 7; // 7 days
      await redisClient.setex(cacheKey, ttlSeconds, JSON.stringify(results));

      return results;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      this.logger.error('Error searching places:', error);
      throw new ServiceUnavailableException(
        'Google Places API is unreachable',
        'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Calculate distance using Google Distance Matrix API
   * (more accurate as it considers actual roads)
   */
  async calculateRouteDistance(
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number },
  ): Promise<{ distance: number; duration: number } | null> {
    try {
      const response = await this.client.distancematrix({
        params: {
          origins: [`${from.latitude},${from.longitude}`],
          destinations: [`${to.latitude},${to.longitude}`],
          key: this.apiKey,
        },
      });

      const element = response.data.rows[0]?.elements[0];

      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      if (element && element.status === 'OK') {
        return {
          distance: element.distance.value, // meters
          duration: element.duration.value, // seconds
        };
      }

      return null;
    } catch (error) {
      console.error('Distance Matrix error:', error);
      return null;
    }
  }

  /**
   * Calculate ETA (Estimated Time of Arrival)
   */
  async calculateETA(
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number },
  ): Promise<number | null> {
    const result = await this.calculateRouteDistance(from, to);
    return result ? result.duration : null;
  }

  /** Get a Valhalla road route and its available alternatives. */
  async getRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<RouteResult | null> {
    // Route origins need street-level identity. Two decimal places groups
    // points roughly a kilometre apart and can return a route that begins on a
    // different road; six decimal places preserves sub-metre GPS identity.
    const cacheKey =
      `maps:route:valhalla:v1:${originLat.toFixed(6)}:${originLng.toFixed(6)}` +
      `:${destLat.toFixed(6)}:${destLng.toFixed(6)}`;

    const redisClient = this.redisService.getClient();
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      this.logger.debug(`[Maps] Route cache hit: ${cacheKey}`);
      return JSON.parse(cached) as RouteResult;
    }

    this.logger.debug(
      `[Maps] Route cache miss — calling Valhalla: ${cacheKey}`,
    );

    const result = await this.valhallaRoutingService.getRoute(
      originLat,
      originLng,
      destLat,
      destLng,
    );
    if (!result) return null;

    // Valhalla currently uses static OSM speeds, so a short cache protects the
    // service without changing the user's expectation of a fresh route.
    await redisClient.setex(cacheKey, 300, JSON.stringify(result));
    this.logger.debug(
      `[Maps] Route cached: ${result.distanceMetres}m, ` +
        `${result.durationSeconds}s, ${result.alternates?.length ?? 0} alternates`,
    );
    return result;
  }
}
