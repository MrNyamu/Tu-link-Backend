import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MapboxService } from './mapbox.service';
import { RoutingService } from './routing.service';
import { 
  NavigationSession,
  NavigationOptions,
  NavigationUpdate,
  NavigationSummary,
  RouteProgress,
  NextInstruction,
  DeviationInfo,
  VoiceInstruction,
  Route,
  CacheOptions 
} from '../interfaces/mapbox.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);
  private readonly cacheTTL: Record<string, number>;

  constructor(
    private readonly mapboxService: MapboxService,
    private readonly routingService: RoutingService,
    private readonly configService: ConfigService
  ) {
    const config = this.configService.get('maps');
    this.cacheTTL = config.cacheTTL;

    this.logger.log('Navigation service initialized');
  }

  async startNavigation(
    origin: [number, number],
    destination: [number, number],
    options: NavigationOptions = {}
  ): Promise<NavigationSession> {
    this.logger.debug(`Starting navigation from [${origin}] to [${destination}]`);

    const route = await this.routingService.calculateRoute([origin, destination], {
      profile: options.profile ?? 'driving-traffic',
      steps: true,
      language: options.language ?? 'en',
      geometries: 'geojson',
      overview: 'full'
    });

    const session: NavigationSession = {
      id: uuidv4(),
      route,
      startTime: new Date(),
      currentStep: 0,
      status: 'active',
      options
    };

    const cacheOptions: CacheOptions = {
      key: `navigation:${session.id}`,
      ttl: this.cacheTTL.navigation,
      enabled: true
    };

    // Store session for tracking
    await this.mapboxService.makeRequest(
      async () => {
        return session;
      },
      cacheOptions,
      'navigation'
    );

    this.logger.debug(`Navigation session started: ${session.id}`);
    return session;
  }

  async updateNavigationProgress(
    sessionId: string,
    currentLocation: [number, number],
    heading?: number
  ): Promise<NavigationUpdate> {
    const session = await this.getNavigationSession(sessionId);
    if (!session) {
      throw new NotFoundException('Navigation session not found');
    }

    this.logger.debug(`Updating navigation progress for session: ${sessionId}`);

    // Calculate progress along route
    const progress = await this.calculateRouteProgress(
      session.route,
      currentLocation,
      session.currentStep
    );

    // Check if we need to recalculate route due to deviation
    const deviation = await this.checkDeviation(session.route, currentLocation);
    let rerouted = false;

    if (deviation.shouldReroute) {
      this.logger.warn(`Route deviation detected for session ${sessionId}, rerouting...`);
      
      const destination = session.route.waypoints[session.route.waypoints.length - 1].coordinates;
      const newRoute = await this.routingService.calculateRoute([
        currentLocation,
        destination
      ], {
        profile: session.options.profile ?? 'driving-traffic',
        steps: true,
        language: session.options.language ?? 'en'
      });
      
      session.route = newRoute;
      session.currentStep = 0;
      rerouted = true;

      this.logger.debug(`Route recalculated for session: ${sessionId}`);
    }

    // Get next instruction
    const nextInstruction = this.getNextInstruction(session.route, progress.currentStep);

    // Calculate ETA
    const estimatedArrival = new Date(Date.now() + progress.durationRemaining * 1000);

    const update: NavigationUpdate = {
      sessionId,
      currentLocation,
      heading,
      progress,
      nextInstruction,
      deviation,
      estimatedArrival,
      rerouted
    };

    // Update session
    session.currentStep = progress.currentStep;
    await this.updateNavigationSession(session);

    this.logger.debug(`Navigation progress updated for session: ${sessionId}`);
    return update;
  }

  async getVoiceInstructions(
    sessionId: string,
    distanceToManeuver: number
  ): Promise<VoiceInstruction[]> {
    const session = await this.getNavigationSession(sessionId);
    if (!session) return [];

    const currentLeg = session.route.legs[0];
    if (!currentLeg?.steps || session.currentStep >= currentLeg.steps.length) {
      return [];
    }

    const currentStep = currentLeg.steps[session.currentStep];
    if (!currentStep?.voiceInstructions) return [];

    // Filter instructions based on distance to maneuver
    const relevantInstructions = currentStep.voiceInstructions.filter(instruction => {
      const distance = instruction.distanceAlongGeometry;
      return distance >= distanceToManeuver - 50 && distance <= distanceToManeuver + 50;
    });

    this.logger.debug(`Found ${relevantInstructions.length} voice instructions for session: ${sessionId}`);
    return relevantInstructions;
  }

  async pauseNavigation(sessionId: string): Promise<NavigationSession> {
    const session = await this.getNavigationSession(sessionId);
    if (!session) {
      throw new NotFoundException('Navigation session not found');
    }

    session.status = 'paused';
    await this.updateNavigationSession(session);

    this.logger.debug(`Navigation paused for session: ${sessionId}`);
    return session;
  }

  async resumeNavigation(sessionId: string): Promise<NavigationSession> {
    const session = await this.getNavigationSession(sessionId);
    if (!session) {
      throw new NotFoundException('Navigation session not found');
    }

    session.status = 'active';
    await this.updateNavigationSession(session);

    this.logger.debug(`Navigation resumed for session: ${sessionId}`);
    return session;
  }

  async endNavigation(sessionId: string): Promise<NavigationSummary> {
    const session = await this.getNavigationSession(sessionId);
    if (!session) {
      throw new NotFoundException('Navigation session not found');
    }

    const endTime = new Date();
    const actualDuration = (endTime.getTime() - session.startTime.getTime()) / 1000;

    const summary: NavigationSummary = {
      sessionId,
      startTime: session.startTime,
      endTime,
      plannedDuration: session.route.duration,
      actualDuration,
      plannedDistance: session.route.distance,
      actualDistance: session.route.distance, // In real implementation, track actual distance
      completed: session.status !== 'cancelled'
    };

    // Clean up session cache
    await this.deleteNavigationSession(sessionId);

    this.logger.debug(`Navigation ended for session: ${sessionId}, duration: ${Math.round(actualDuration / 60)}min`);
    return summary;
  }

  async cancelNavigation(sessionId: string): Promise<NavigationSummary> {
    const session = await this.getNavigationSession(sessionId);
    if (!session) {
      throw new NotFoundException('Navigation session not found');
    }

    session.status = 'cancelled';
    return this.endNavigation(sessionId);
  }

  private async calculateRouteProgress(
    route: Route,
    currentLocation: [number, number],
    currentStep: number
  ): Promise<RouteProgress> {
    // Simplified progress calculation
    // In a real implementation, this would use precise polyline calculations
    
    const leg = route.legs[0];
    if (!leg?.steps || currentStep >= leg.steps.length) {
      return {
        currentStep: currentStep,
        distanceRemaining: 0,
        durationRemaining: 0,
        distanceTraveled: route.distance,
        fractionTraveled: 1.0,
        remainingSteps: []
      };
    }

    // Calculate remaining distance and duration from current step onward
    const remainingSteps = leg.steps.slice(currentStep);
    const distanceRemaining = remainingSteps.reduce((sum, step) => sum + step.distance, 0);
    const durationRemaining = remainingSteps.reduce((sum, step) => sum + step.duration, 0);
    
    const distanceTraveled = route.distance - distanceRemaining;
    const fractionTraveled = route.distance > 0 ? distanceTraveled / route.distance : 0;

    return {
      currentStep,
      distanceRemaining,
      durationRemaining,
      distanceTraveled,
      fractionTraveled,
      remainingSteps
    };
  }

  private getNextInstruction(route: Route, currentStep: number): NextInstruction | undefined {
    const leg = route.legs[0];
    if (!leg?.steps || currentStep >= leg.steps.length) {
      return undefined;
    }

    const step = leg.steps[currentStep];
    const maneuver = step.maneuver;

    return {
      distance: step.distance,
      instruction: maneuver.instruction,
      type: maneuver.type,
      modifier: maneuver.modifier
    };
  }

  private async checkDeviation(
    route: Route,
    currentLocation: [number, number]
  ): Promise<DeviationInfo> {
    // Simplified deviation check
    // In a real implementation, this would use more sophisticated algorithms
    
    const routeCoordinates = route.geometry.coordinates as [number, number][];
    
    // Find the closest point on the route to current location
    let minDistance = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < routeCoordinates.length; i++) {
      const distance = this.calculateHaversineDistance(currentLocation, routeCoordinates[i]);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    // Convert to meters
    const deviationDistance = minDistance * 1000;
    
    // Determine if rerouting is needed (threshold: 100 meters)
    const shouldReroute = deviationDistance > 100;
    
    // Calculate confidence based on deviation distance
    const confidence = Math.max(0, 1 - (deviationDistance / 500));

    return {
      distance: deviationDistance,
      shouldReroute,
      confidence
    };
  }

  private calculateHaversineDistance(
    coord1: [number, number],
    coord2: [number, number]
  ): number {
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;
    
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  }

  private async getNavigationSession(sessionId: string): Promise<NavigationSession | null> {
    try {
      const session = await this.mapboxService['getCachedResult']<NavigationSession>(`navigation:${sessionId}`);
      return session;
    } catch (error) {
      this.logger.warn(`Failed to retrieve navigation session ${sessionId}:`, error.message);
      return null;
    }
  }

  private async updateNavigationSession(session: NavigationSession): Promise<void> {
    const cacheOptions: CacheOptions = {
      key: `navigation:${session.id}`,
      ttl: this.cacheTTL.navigation,
      enabled: true
    };

    await this.mapboxService.makeRequest(
      async () => session,
      cacheOptions,
      'navigation'
    );
  }

  private async deleteNavigationSession(sessionId: string): Promise<void> {
    try {
      // Note: This would need access to Redis directly to delete
      // For now, we'll set a short TTL
      const cacheOptions: CacheOptions = {
        key: `navigation:${sessionId}`,
        ttl: 1, // 1 second TTL for quick cleanup
        enabled: true
      };

      await this.mapboxService.makeRequest(
        async () => null,
        cacheOptions,
        'navigation'
      );
    } catch (error) {
      this.logger.warn(`Failed to delete navigation session ${sessionId}:`, error.message);
    }
  }

  async getActiveNavigationSessions(): Promise<NavigationSession[]> {
    // In a real implementation, this would query all active navigation sessions
    // For now, return empty array as we need direct Redis access
    this.logger.debug('Getting active navigation sessions');
    return [];
  }

  async getNavigationStatistics(): Promise<{
    activeSessions: number;
    completedSessions: number;
    averageDuration: number;
    totalDistance: number;
  }> {
    // In a real implementation, this would aggregate session statistics
    this.logger.debug('Getting navigation statistics');
    
    return {
      activeSessions: 0,
      completedSessions: 0,
      averageDuration: 0,
      totalDistance: 0
    };
  }

  validateNavigationOptions(options: NavigationOptions): boolean {
    if (options.profile && !['driving', 'walking', 'cycling', 'driving-traffic'].includes(options.profile)) {
      return false;
    }

    if (options.units && !['metric', 'imperial'].includes(options.units)) {
      return false;
    }

    if (options.language && typeof options.language !== 'string') {
      return false;
    }

    return true;
  }
}