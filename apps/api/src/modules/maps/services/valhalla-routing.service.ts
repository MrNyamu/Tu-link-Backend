import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RouteResult, RouteStep } from '../interfaces/place-result.interface';

interface ValhallaManeuver {
  type: number;
  instruction?: string;
  length: number;
  begin_shape_index: number;
  end_shape_index: number;
}

interface ValhallaLeg {
  shape: string;
  maneuvers?: ValhallaManeuver[];
}

interface ValhallaTrip {
  summary: {
    length: number;
    time: number;
  };
  legs: ValhallaLeg[];
}

interface ValhallaRouteResponse {
  trip?: ValhallaTrip;
  alternates?: Array<{ trip: ValhallaTrip }>;
  error?: string;
  error_code?: number;
}

@Injectable()
export class ValhallaRoutingService {
  private readonly logger = new Logger(ValhallaRoutingService.name);

  constructor(private readonly configService: ConfigService) {}

  async getRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<RouteResult | null> {
    const baseUrl = this.configService
      .get<string>('maps.valhallaUrl', 'http://localhost:8002')
      .replace(/\/$/, '');
    const timeoutMs = this.configService.get<number>(
      'maps.requestTimeoutMs',
      8000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locations: [
            { lat: originLat, lon: originLng },
            { lat: destLat, lon: destLng },
          ],
          costing: 'auto',
          units: 'kilometers',
          alternates: 2,
          directions_options: {
            units: 'kilometers',
            language: 'en-US',
          },
        }),
        signal: controller.signal,
      });

      const rawBody = await response.text();
      const data = this.parseResponse(rawBody);

      if (!response.ok || data.error) {
        if (this.isNoRouteResponse(data)) {
          this.logger.warn(
            `Valhalla found no route (${data.error_code ?? response.status})`,
          );
          return null;
        }

        this.logger.error(
          `Valhalla route error: HTTP ${response.status}, ` +
            `code ${data.error_code ?? 'unknown'}`,
        );
        throw new BadGatewayException(
          'Routing service request failed',
          'UPSTREAM_DIRECTIONS_ERROR',
        );
      }

      if (!data.trip) {
        this.logger.error(
          'Valhalla returned a successful response without a trip',
        );
        throw new BadGatewayException(
          'Routing service returned an invalid response',
          'UPSTREAM_DIRECTIONS_ERROR',
        );
      }

      const primary = this.normalizeTrip(data.trip);
      primary.alternates = (data.alternates ?? []).map(({ trip }) =>
        this.normalizeTrip(trip),
      );
      return primary;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;

      this.logger.error(
        'Valhalla routing service is unreachable',
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        'Routing service is unavailable',
        'UPSTREAM_UNAVAILABLE',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseResponse(body: string): ValhallaRouteResponse {
    if (!body) return {};
    try {
      return JSON.parse(body) as ValhallaRouteResponse;
    } catch {
      return {};
    }
  }

  private isNoRouteResponse(data: ValhallaRouteResponse): boolean {
    return (
      data.error_code === 170 ||
      data.error_code === 171 ||
      data.error_code === 442
    );
  }

  private normalizeTrip(trip: ValhallaTrip): RouteResult {
    const coordinates: number[][] = [];
    const steps: RouteStep[] = [];

    for (const leg of trip.legs) {
      coordinates.push(...decodePolyline6(leg.shape));
      steps.push(
        ...(leg.maneuvers ?? []).map((maneuver) => ({
          instruction: maneuver.instruction ?? '',
          distanceMetres: maneuver.length * 1000,
          maneuver: normalizeManeuverType(maneuver.type),
        })),
      );
    }

    return {
      coordinates,
      distanceMetres: trip.summary.length * 1000,
      durationSeconds: trip.summary.time,
      steps,
    };
  }
}

/** Decode Valhalla's six-decimal encoded shape into GeoJSON [lng, lat]. */
export function decodePolyline6(encoded: string): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const latitudeDelta = decodeValue(encoded, index);
    index = latitudeDelta.nextIndex;
    latitude += latitudeDelta.value;

    const longitudeDelta = decodeValue(encoded, index);
    index = longitudeDelta.nextIndex;
    longitude += longitudeDelta.value;

    coordinates.push([longitude / 1e6, latitude / 1e6]);
  }

  return coordinates;
}

function decodeValue(
  encoded: string,
  startIndex: number,
): { value: number; nextIndex: number } {
  let index = startIndex;
  let shift = 0;
  let result = 0;
  let byte: number;

  do {
    if (index >= encoded.length) {
      throw new Error('Invalid encoded route shape');
    }
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  return {
    value: result & 1 ? ~(result >> 1) : result >> 1,
    nextIndex: index,
  };
}

/** Keep the stable maneuver vocabulary already understood by Flutter. */
export function normalizeManeuverType(type: number): string {
  if (type >= 1 && type <= 3) return 'depart';
  if (type >= 4 && type <= 6) return 'arrive';
  if (type === 7 || type === 8 || type === 22) return 'continue';
  if (type === 9) return 'turn-slight-right';
  if (type === 10) return 'turn-right';
  if (type === 11) return 'turn-sharp-right';
  if (type === 12 || type === 13) return 'uturn';
  if (type === 14) return 'turn-sharp-left';
  if (type === 15) return 'turn-left';
  if (type === 16) return 'turn-slight-left';
  if (type === 17) return 'continue';
  if (type === 18 || type === 20) return 'turn-right';
  if (type === 19 || type === 21) return 'turn-left';
  if (type === 23 || type === 24) return 'fork';
  if (type === 25 || type === 37 || type === 38) return 'merge';
  if (type === 26 || type === 27) return 'roundabout';
  if (type === 28 || type === 29) return 'ferry';
  return 'straight';
}
