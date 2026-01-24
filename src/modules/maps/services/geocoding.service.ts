import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import geocoding from '@mapbox/mapbox-sdk/services/geocoding';
import { MapboxService } from './mapbox.service';
import { 
  GeocodingResult, 
  GeocodingOptions,
  CacheOptions 
} from '../interfaces/mapbox.interface';

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly geocodingClient: ReturnType<typeof geocoding>;
  private readonly cacheTTL: Record<string, number>;

  constructor(
    private readonly mapboxService: MapboxService,
    private readonly configService: ConfigService
  ) {
    const config = this.configService.get('maps');
    this.cacheTTL = config.cacheTTL;
    
    this.geocodingClient = geocoding({
      accessToken: config.mapboxAccessToken
    });

    this.logger.log('Geocoding service initialized');
  }

  async searchPlaces(
    query: string,
    options: GeocodingOptions = {}
  ): Promise<GeocodingResult[]> {
    if (!query?.trim()) {
      throw new Error('Search query cannot be empty');
    }

    const cacheKey = `geocoding:search:${this.mapboxService.hashQuery(query, options)}`;
    const cacheOptions: CacheOptions = {
      key: cacheKey,
      ttl: this.cacheTTL.geocoding,
      enabled: true
    };

    return this.mapboxService.makeRequest(
      async () => {
        this.logger.debug(`Geocoding search: "${query}" with options:`, options);

        const response = await this.geocodingClient
          .forwardGeocode({
            query,
            autocomplete: options.autocomplete ?? true,
            bbox: options.bbox,
            proximity: options.proximity,
            countries: options.country,
            types: options.types,
            limit: Math.min(options.limit ?? 10, 10), // Mapbox max is 10
            language: options.language,
            fuzzyMatch: true
          })
          .send();

        if (!response.body.features || response.body.features.length === 0) {
          this.logger.warn(`No results found for query: "${query}"`);
          return [];
        }

        const results = response.body.features.map(feature => ({
          id: feature.id,
          text: feature.text,
          placeName: feature.place_name,
          coordinates: feature.center as [number, number],
          bbox: feature.bbox,
          properties: feature.properties,
          context: feature.context?.map(ctx => ({
            id: ctx.id,
            text: ctx.text,
            wikidata: ctx.wikidata,
            short_code: ctx.short_code
          })),
          relevance: feature.relevance
        }));

        this.logger.debug(`Found ${results.length} results for query: "${query}"`);
        return results;
      },
      cacheOptions,
      'geocoding'
    );
  }

  async reverseGeocode(
    coordinates: [number, number],
    types?: string[]
  ): Promise<GeocodingResult> {
    if (!coordinates || coordinates.length !== 2) {
      throw new Error('Invalid coordinates provided');
    }

    const [lng, lat] = coordinates;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Coordinates out of valid range');
    }

    const cacheKey = `geocoding:reverse:${lng.toFixed(6)},${lat.toFixed(6)}_${types?.join(',')}`;
    const cacheOptions: CacheOptions = {
      key: cacheKey,
      ttl: this.cacheTTL.geocoding * 7, // Cache reverse geocoding longer (7 days)
      enabled: true
    };

    return this.mapboxService.makeRequest(
      async () => {
        this.logger.debug(`Reverse geocoding: [${lng}, ${lat}]`);

        const response = await this.geocodingClient
          .reverseGeocode({
            query: coordinates,
            types: types as any[],
            limit: 1
          })
          .send();

        const feature = response.body.features[0];
        if (!feature) {
          throw new NotFoundException(`No location found for coordinates [${lng}, ${lat}]`);
        }

        const result: GeocodingResult = {
          id: feature.id,
          text: feature.text,
          placeName: feature.place_name,
          coordinates: feature.center as [number, number],
          bbox: feature.bbox,
          properties: feature.properties,
          context: feature.context?.map(ctx => ({
            id: ctx.id,
            text: ctx.text,
            wikidata: ctx.wikidata,
            short_code: ctx.short_code
          })),
          relevance: feature.relevance
        };

        this.logger.debug(`Reverse geocoding result: ${result.placeName}`);
        return result;
      },
      cacheOptions,
      'geocoding'
    );
  }

  async batchGeocode(
    queries: string[],
    options: GeocodingOptions = {}
  ): Promise<GeocodingResult[][]> {
    if (!queries || queries.length === 0) {
      return [];
    }

    // Process in chunks to avoid overwhelming the API
    const chunks = this.mapboxService.chunkArray(queries, 5);
    const results: GeocodingResult[][] = [];

    this.logger.debug(`Batch geocoding ${queries.length} queries in ${chunks.length} chunks`);

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(query => this.searchPlaces(query, options))
      );
      results.push(...chunkResults);
      
      // Small delay between chunks to be respectful to the API
      if (chunks.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.logger.debug(`Batch geocoding completed: ${results.length} result sets`);
    return results;
  }

  async getPlaceDetails(placeId: string): Promise<GeocodingResult> {
    if (!placeId?.trim()) {
      throw new Error('Place ID cannot be empty');
    }

    const cacheKey = `geocoding:place:${placeId}`;
    const cacheOptions: CacheOptions = {
      key: cacheKey,
      ttl: this.cacheTTL.geocoding * 7, // Cache place details longer
      enabled: true
    };

    return this.mapboxService.makeRequest(
      async () => {
        this.logger.debug(`Getting place details for ID: ${placeId}`);

        // For Mapbox, place details are typically retrieved via the place ID in a geocoding request
        const response = await this.geocodingClient
          .forwardGeocode({
            query: placeId,
            limit: 1
          })
          .send();

        const feature = response.body.features[0];
        if (!feature) {
          throw new NotFoundException(`Place not found for ID: ${placeId}`);
        }

        const result: GeocodingResult = {
          id: feature.id,
          text: feature.text,
          placeName: feature.place_name,
          coordinates: feature.center as [number, number],
          bbox: feature.bbox,
          properties: feature.properties,
          context: feature.context?.map(ctx => ({
            id: ctx.id,
            text: ctx.text,
            wikidata: ctx.wikidata,
            short_code: ctx.short_code
          })),
          relevance: feature.relevance
        };

        this.logger.debug(`Place details retrieved: ${result.placeName}`);
        return result;
      },
      cacheOptions,
      'geocoding'
    );
  }

  async searchNearby(
    center: [number, number],
    radius: number, // in meters
    query?: string,
    types?: string[]
  ): Promise<GeocodingResult[]> {
    const [lng, lat] = center;
    
    // Convert radius to approximate bbox (rough calculation)
    const latDelta = (radius / 111000); // 1 degree lat ≈ 111km
    const lngDelta = radius / (111000 * Math.cos(lat * Math.PI / 180));
    
    const bbox: [number, number, number, number] = [
      lng - lngDelta,
      lat - latDelta, 
      lng + lngDelta,
      lat + latDelta
    ];

    const options: GeocodingOptions = {
      bbox,
      proximity: center,
      types,
      limit: 10
    };

    this.logger.debug(`Searching nearby places within ${radius}m of [${lng}, ${lat}]`);

    if (query) {
      return this.searchPlaces(query, options);
    } else {
      // For nearby search without query, we'll search for POIs
      return this.searchPlaces('poi', options);
    }
  }

  async autocomplete(
    query: string,
    options: GeocodingOptions = {}
  ): Promise<GeocodingResult[]> {
    if (!query?.trim() || query.length < 2) {
      return [];
    }

    const autocompleteOptions: GeocodingOptions = {
      ...options,
      autocomplete: true,
      limit: Math.min(options.limit ?? 5, 5) // Smaller limit for autocomplete
    };

    this.logger.debug(`Autocomplete search: "${query}"`);
    return this.searchPlaces(query, autocompleteOptions);
  }

  async validateCoordinates(coordinates: [number, number]): Promise<boolean> {
    const [lng, lat] = coordinates;
    
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return false;
    }
    
    if (isNaN(lng) || isNaN(lat)) {
      return false;
    }
    
    if (lng < -180 || lng > 180) {
      return false;
    }
    
    if (lat < -90 || lat > 90) {
      return false;
    }
    
    return true;
  }
}