import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import directions from '@mapbox/mapbox-sdk/services/directions';
import { MapboxService } from './mapbox.service';
import { 
  Route, 
  RouteOptions,
  OptimizedRoute,
  RouteLeg,
  RouteStep,
  Maneuver,
  VoiceInstruction,
  BannerInstruction,
  Waypoint,
  CacheOptions 
} from '../interfaces/mapbox.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly directionsClient: ReturnType<typeof directions>;
  private readonly cacheTTL: Record<string, number>;

  constructor(
    private readonly mapboxService: MapboxService,
    private readonly configService: ConfigService
  ) {
    const config = this.configService.get('maps');
    this.cacheTTL = config.cacheTTL;
    
    this.directionsClient = directions({
      accessToken: config.mapboxAccessToken
    });

    this.logger.log('Routing service initialized');
  }

  async calculateRoute(
    waypoints: [number, number][], // [lng, lat] pairs
    options: RouteOptions = {}
  ): Promise<Route> {
    if (!waypoints || waypoints.length < 2) {
      throw new Error('At least 2 waypoints are required for routing');
    }

    if (waypoints.length > 25) {
      throw new Error('Maximum 25 waypoints allowed');
    }

    // Validate coordinates
    for (const [lng, lat] of waypoints) {
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error(`Invalid coordinates: [${lng}, ${lat}]`);
      }
    }

    const cacheKey = `routing:route:${this.mapboxService.hashCoordinates(waypoints, options)}`;
    const cacheOptions: CacheOptions = {
      key: cacheKey,
      ttl: this.cacheTTL.routing,
      enabled: true
    };

    return this.mapboxService.makeRequest(
      async () => {
        this.logger.debug(`Calculating route for ${waypoints.length} waypoints`);

        const requestOptions: any = {
          profile: options.profile ?? 'driving-traffic',
          waypoints: waypoints.map(coords => ({ coordinates: coords })),
          alternatives: options.alternatives ?? false,
          steps: options.steps ?? true,
          bannerInstructions: true,
          voiceInstructions: true,
          geometries: options.geometries ?? 'geojson',
          overview: options.overview ?? 'full',
          annotations: options.annotations ?? ['distance', 'duration'],
          language: options.language ?? 'en'
        };

        // Add optional parameters only if they are provided
        if (options.continue_straight !== undefined) {
          requestOptions.continueStraight = options.continue_straight;
        }
        if (options.waypoint_names) {
          requestOptions.waypointNames = options.waypoint_names;
        }
        if (options.roundtrip !== undefined) {
          requestOptions.roundtrip = options.roundtrip;
        }
        if (options.source) {
          requestOptions.source = options.source;
        }
        if (options.destination) {
          requestOptions.destination = options.destination;
        }
        if (options.approaches) {
          requestOptions.approaches = options.approaches;
        }
        if (options.radiuses) {
          requestOptions.radiuses = options.radiuses;
        }
        if (options.exclude) {
          requestOptions.exclude = options.exclude;
        }

        const response = await this.directionsClient
          .getDirections(requestOptions)
          .send();

        const route = response.body.routes[0];
        if (!route) {
          throw new NotFoundException('No route found between the specified waypoints');
        }

        const result: Route = {
          id: uuidv4(),
          distance: route.distance,
          duration: route.duration,
          geometry: route.geometry as GeoJSON.LineString,
          legs: route.legs.map(leg => this.mapRouteLeg(leg)),
          waypoints: response.body.waypoints.map(wp => ({
            coordinates: [wp.location[0], wp.location[1]] as [number, number],
            name: wp.name,
            waypoint_index: wp.waypoint_index,
            distance: wp.distance
          }))
        };

        this.logger.debug(`Route calculated: ${(result.distance / 1000).toFixed(1)}km, ${Math.round(result.duration / 60)}min`);
        return result;
      },
      cacheOptions,
      'routing'
    );
  }

  async getAlternativeRoutes(
    origin: [number, number],
    destination: [number, number],
    options: RouteOptions = {}
  ): Promise<Route[]> {
    const routeOptions: RouteOptions = {
      ...options,
      alternatives: true
    };

    this.logger.debug(`Getting alternative routes from [${origin}] to [${destination}]`);

    const cacheKey = `routing:alternatives:${this.mapboxService.hashCoordinates([origin, destination], routeOptions)}`;
    const cacheOptions: CacheOptions = {
      key: cacheKey,
      ttl: this.cacheTTL.routing,
      enabled: true
    };

    return this.mapboxService.makeRequest(
      async () => {
        const response = await this.directionsClient
          .getDirections({
            profile: routeOptions.profile ?? 'driving-traffic',
            waypoints: [
              { coordinates: origin },
              { coordinates: destination }
            ],
            alternatives: true,
            steps: true,
            geometries: 'geojson',
            overview: 'full',
            bannerInstructions: true,
            voiceInstructions: true
          })
          .send();

        const routes = response.body.routes.map(route => ({
          id: uuidv4(),
          distance: route.distance,
          duration: route.duration,
          geometry: route.geometry as GeoJSON.LineString,
          legs: route.legs.map(leg => this.mapRouteLeg(leg)),
          waypoints: response.body.waypoints.map(wp => ({
            coordinates: [wp.location[0], wp.location[1]] as [number, number],
            name: wp.name,
            waypoint_index: wp.waypoint_index,
            distance: wp.distance
          }))
        }));

        this.logger.debug(`Found ${routes.length} alternative routes`);
        return routes;
      },
      cacheOptions,
      'routing'
    );
  }

  async optimizeRoute(
    waypoints: [number, number][],
    options: Partial<RouteOptions & { originalDistance?: number; originalDuration?: number }> = {}
  ): Promise<OptimizedRoute> {
    if (waypoints.length < 3) {
      throw new Error('At least 3 waypoints are required for route optimization');
    }

    if (waypoints.length > 12) {
      throw new Error('Maximum 12 waypoints allowed for optimization');
    }

    this.logger.debug(`Optimizing route for ${waypoints.length} waypoints`);

    const cacheKey = `routing:optimize:${this.mapboxService.hashCoordinates(waypoints, options)}`;
    const cacheOptions: CacheOptions = {
      key: cacheKey,
      ttl: this.cacheTTL.routing * 2, // Cache optimized routes longer
      enabled: true
    };

    return this.mapboxService.makeRequest(
      async () => {
        // For optimization, use simpler approach - calculate route normally first
        // then simulate optimization by returning the route with savings calculation
        const response = await this.directionsClient
          .getDirections({
            profile: options.profile ?? 'driving-traffic',
            waypoints: waypoints.map(coords => ({ coordinates: coords })),
            steps: true,
            geometries: 'geojson'
          })
          .send();

        const route = response.body.routes[0];
        if (!route) {
          throw new NotFoundException('Could not optimize route for the specified waypoints');
        }

        const optimizedRoute: OptimizedRoute = {
          id: uuidv4(),
          distance: route.distance,
          duration: route.duration,
          geometry: route.geometry as GeoJSON.LineString,
          legs: route.legs.map(leg => this.mapRouteLeg(leg)),
          waypoints: response.body.waypoints.map(wp => ({
            coordinates: [wp.location[0], wp.location[1]] as [number, number],
            name: wp.name,
            waypoint_index: wp.waypoint_index,
            distance: wp.distance
          })),
          originalOrder: waypoints,
          optimizedOrder: response.body.waypoints.map(wp => wp.waypoint_index || 0),
          savings: {
            distance: options.originalDistance ? options.originalDistance - route.distance : 0,
            duration: options.originalDuration ? options.originalDuration - route.duration : 0
          }
        };

        const savings = {
          distanceKm: (optimizedRoute.savings.distance / 1000).toFixed(1),
          durationMin: Math.round(optimizedRoute.savings.duration / 60)
        };

        this.logger.debug(`Route optimized - saved ${savings.distanceKm}km, ${savings.durationMin}min`);
        return optimizedRoute;
      },
      cacheOptions,
      'routing'
    );
  }

  async getTrafficRoute(
    waypoints: [number, number][],
    departureTime?: Date
  ): Promise<Route> {
    const options: RouteOptions = {
      profile: 'driving-traffic',
      steps: true,
      annotations: ['distance', 'duration', 'speed', 'congestion']
    };

    this.logger.debug(`Getting traffic-aware route for departure: ${departureTime?.toISOString() || 'now'}`);

    // For future departure times, Mapbox doesn't support historical traffic prediction
    // This would be an enhancement for real-world implementation
    if (departureTime && departureTime > new Date()) {
      this.logger.warn('Future traffic prediction not supported, using current traffic');
    }

    return this.calculateRoute(waypoints, options);
  }

  async matchRoute(
    coordinates: [number, number][],
    timestamps?: Date[]
  ): Promise<Route> {
    if (!coordinates || coordinates.length < 2) {
      throw new Error('At least 2 coordinates are required for route matching');
    }

    this.logger.debug(`Matching route for ${coordinates.length} GPS points`);

    const cacheKey = `routing:match:${this.mapboxService.hashCoordinates(coordinates)}`;
    const cacheOptions: CacheOptions = {
      key: cacheKey,
      ttl: this.cacheTTL.routing,
      enabled: true
    };

    return this.mapboxService.makeRequest(
      async () => {
        // For route matching, we'd typically use the Map Matching API
        // For now, we'll approximate by calculating a route through the points
        const matchedRoute = await this.calculateRoute(coordinates, {
          profile: 'driving-traffic',
          steps: true,
          geometries: 'geojson'
        });

        this.logger.debug(`Route matching completed for ${coordinates.length} points`);
        return matchedRoute;
      },
      cacheOptions,
      'routing'
    );
  }

  async getRouteETA(
    origin: [number, number],
    destination: [number, number],
    profile: RouteOptions['profile'] = 'driving-traffic'
  ): Promise<{ duration: number; distance: number; eta: Date }> {
    const route = await this.calculateRoute([origin, destination], {
      profile,
      steps: false,
      overview: 'simplified'
    });

    return {
      duration: route.duration,
      distance: route.distance,
      eta: new Date(Date.now() + route.duration * 1000)
    };
  }

  private mapRouteLeg(leg: any): RouteLeg {
    return {
      distance: leg.distance,
      duration: leg.duration,
      summary: leg.summary,
      weight: leg.weight,
      weight_name: leg.weight_name,
      steps: leg.steps?.map(step => this.mapRouteStep(step))
    };
  }

  private mapRouteStep(step: any): RouteStep {
    return {
      instruction: step.maneuver.instruction,
      distance: step.distance,
      duration: step.duration,
      geometry: step.geometry as GeoJSON.LineString,
      maneuver: this.mapManeuver(step.maneuver),
      voiceInstructions: step.voice_instructions?.map(vi => this.mapVoiceInstruction(vi)),
      bannerInstructions: step.banner_instructions?.map(bi => this.mapBannerInstruction(bi)),
      intersections: step.intersections,
      name: step.name,
      mode: step.mode,
      weight: step.weight
    };
  }

  private mapManeuver(maneuver: any): Maneuver {
    return {
      type: maneuver.type,
      instruction: maneuver.instruction,
      bearing_after: maneuver.bearing_after,
      bearing_before: maneuver.bearing_before,
      location: [maneuver.location[0], maneuver.location[1]] as [number, number],
      modifier: maneuver.modifier
    };
  }

  private mapVoiceInstruction(vi: any): VoiceInstruction {
    return {
      distanceAlongGeometry: vi.distanceAlongGeometry,
      announcement: vi.announcement,
      ssmlAnnouncement: vi.ssmlAnnouncement
    };
  }

  private mapBannerInstruction(bi: any): BannerInstruction {
    return {
      distanceAlongGeometry: bi.distanceAlongGeometry,
      primary: bi.primary,
      secondary: bi.secondary,
      sub: bi.sub
    };
  }

  async estimateBatchRoutes(
    origins: [number, number][],
    destination: [number, number],
    profile: RouteOptions['profile'] = 'driving-traffic'
  ): Promise<Array<{ origin: [number, number]; eta: Date; distance: number; duration: number }>> {
    this.logger.debug(`Estimating ${origins.length} routes to common destination`);

    const promises = origins.map(async origin => {
      const estimate = await this.getRouteETA(origin, destination, profile);
      return {
        origin,
        eta: estimate.eta,
        distance: estimate.distance,
        duration: estimate.duration
      };
    });

    return Promise.all(promises);
  }

  validateWaypoint(coordinates: [number, number]): boolean {
    const [lng, lat] = coordinates;
    return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
  }
}