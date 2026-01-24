import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MapboxService } from './mapbox.service';
import { RoutingService } from './routing.service';
import { 
  NavigationSession,
  NavigationOptions,
  Route,
  RouteStep,
  CacheOptions 
} from '../interfaces/mapbox.interface';
import { 
  CompactRouteDto,
  NavigationChunkRequestDto,
  NavigationChunkResponseDto,
  NavigationUpdateOptimizedDto,
  ProgressiveNavigationResponseDto
} from '../dto/navigation-optimized.dto';
import { v4 as uuidv4 } from 'uuid';
import * as polyline from '@mapbox/polyline';

interface CachedRoute {
  originalRoute: Route;
  compactSegments: CompactRouteSegment[];
  totalSegments: number;
  instructions: RouteInstruction[];
}

interface CompactRouteSegment {
  coordinates: [number, number];
  distance: number;
  duration: number;
  instructionIndex?: number;
}

interface RouteInstruction {
  text: string;
  type: string;
  distance: number;
  segmentIndex: number;
}

@Injectable()
export class OptimizedNavigationService {
  private readonly logger = new Logger(OptimizedNavigationService.name);
  private readonly cacheTTL: Record<string, number>;
  
  // In-memory cache for active sessions (in production, use Redis)
  private activeSessions = new Map<string, CachedRoute>();

  constructor(
    private readonly mapboxService: MapboxService,
    private readonly routingService: RoutingService,
    private readonly configService: ConfigService
  ) {
    const config = this.configService.get('maps');
    this.cacheTTL = config.cacheTTL;
    this.logger.log('Optimized Navigation service initialized');
  }

  async startOptimizedNavigation(
    origin: [number, number],
    destination: [number, number],
    options: NavigationOptions = {}
  ): Promise<{ sessionId: string; initialChunk: NavigationChunkResponseDto }> {
    this.logger.debug(`Starting optimized navigation from [${origin}] to [${destination}]`);

    // Get full route with detailed instructions
    const route = await this.routingService.calculateRoute([origin, destination], {
      profile: options.profile ?? 'driving-traffic',
      steps: true,
      language: options.language ?? 'en',
      geometries: 'geojson',
      overview: 'full'
    });

    const sessionId = uuidv4();
    
    // Convert route to compact format
    const compactRoute = this.convertToCompactFormat(route);
    
    // Cache the route data
    this.activeSessions.set(sessionId, compactRoute);

    // Return initial chunk (first 50 segments)
    const initialChunk = this.getRouteChunk(sessionId, 0, 50, options.voice);

    this.logger.debug(`Optimized navigation session started: ${sessionId}`);
    
    return {
      sessionId,
      initialChunk
    };
  }

  async updateOptimizedNavigation(
    sessionId: string,
    update: NavigationUpdateOptimizedDto
  ): Promise<ProgressiveNavigationResponseDto> {
    const cachedRoute = this.activeSessions.get(sessionId);
    if (!cachedRoute) {
      throw new NotFoundException('Navigation session not found');
    }

    // Find current position on route
    const currentIndex = this.findNearestSegmentIndex(
      cachedRoute.compactSegments,
      update.currentLocation
    );

    // Calculate progress
    const progress = this.calculateProgress(cachedRoute, currentIndex);

    // Get next instruction
    const nextInstruction = this.getNextInstruction(cachedRoute, currentIndex);

    // Check if rerouting is needed
    const rerouteRequired = this.shouldReroute(
      cachedRoute.compactSegments[currentIndex],
      update.currentLocation
    );

    // Get next chunk if requested
    let chunk: NavigationChunkResponseDto | undefined;
    if (update.requestNextChunk) {
      chunk = this.getRouteChunk(sessionId, currentIndex, 50, false);
    }

    return {
      progress,
      nextInstruction,
      chunk,
      rerouteRequired,
      estimatedArrival: new Date(Date.now() + progress.durationRemaining * 1000)
    };
  }

  getRouteChunk(
    sessionId: string,
    startIndex: number,
    count: number = 50,
    includeVoice: boolean = false
  ): NavigationChunkResponseDto {
    const cachedRoute = this.activeSessions.get(sessionId);
    if (!cachedRoute) {
      throw new NotFoundException('Navigation session not found');
    }

    const endIndex = Math.min(startIndex + count, cachedRoute.totalSegments);
    const segments = cachedRoute.compactSegments.slice(startIndex, endIndex);

    // Extract coordinates for polyline encoding
    const coordinates = segments.map(segment => segment.coordinates);
    const encodedGeometry = polyline.encode(coordinates);

    // Extract distances and durations
    const distances = segments.map(segment => segment.distance);
    const durations = segments.map(segment => segment.duration);

    // Get instruction indices and texts for this chunk
    const instructionIndices: number[] = [];
    const instructions: string[] = [];
    
    segments.forEach((segment, index) => {
      if (segment.instructionIndex !== undefined) {
        instructionIndices.push(index);
        instructions.push(cachedRoute.instructions[segment.instructionIndex].text);
      }
    });

    const chunk: CompactRouteDto = {
      geometry: encodedGeometry,
      distances,
      durations,
      instructionIndices,
      instructions
    };

    let voiceInstructions: Array<{ index: number; text: string; distance: number }> | undefined;
    
    if (includeVoice) {
      voiceInstructions = segments
        .map((segment, index) => {
          if (segment.instructionIndex !== undefined) {
            const instruction = cachedRoute.instructions[segment.instructionIndex];
            return {
              index,
              text: instruction.text,
              distance: instruction.distance
            };
          }
          return null;
        })
        .filter(Boolean) as Array<{ index: number; text: string; distance: number }>;
    }

    return {
      chunk,
      startIndex,
      endIndex,
      totalSegments: cachedRoute.totalSegments,
      voiceInstructions
    };
  }

  private convertToCompactFormat(route: Route): CachedRoute {
    const segments: CompactRouteSegment[] = [];
    const instructions: RouteInstruction[] = [];
    let instructionIndex = 0;

    route.legs.forEach(leg => {
      leg.steps?.forEach((step, stepIndex) => {
        // Add instruction
        instructions.push({
          text: step.instruction,
          type: step.maneuver.type,
          distance: step.distance,
          segmentIndex: segments.length
        });

        // Convert step geometry to segments
        if (step.geometry.type === 'LineString') {
          step.geometry.coordinates.forEach((coord, coordIndex) => {
            segments.push({
              coordinates: [coord[0], coord[1]],
              distance: step.distance / step.geometry.coordinates.length,
              duration: step.duration / step.geometry.coordinates.length,
              instructionIndex: coordIndex === 0 ? instructionIndex : undefined
            });
          });
        }

        instructionIndex++;
      });
    });

    return {
      originalRoute: route,
      compactSegments: segments,
      totalSegments: segments.length,
      instructions
    };
  }

  private findNearestSegmentIndex(
    segments: CompactRouteSegment[],
    location: [number, number]
  ): number {
    let minDistance = Infinity;
    let nearestIndex = 0;

    segments.forEach((segment, index) => {
      const distance = this.haversineDistance(
        location,
        segment.coordinates
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  }

  private calculateProgress(route: CachedRoute, currentIndex: number) {
    const remainingSegments = route.compactSegments.slice(currentIndex);
    const completedSegments = route.compactSegments.slice(0, currentIndex);

    const distanceRemaining = remainingSegments.reduce((sum, seg) => sum + seg.distance, 0);
    const durationRemaining = remainingSegments.reduce((sum, seg) => sum + seg.duration, 0);
    const distanceTraveled = completedSegments.reduce((sum, seg) => sum + seg.distance, 0);
    const totalDistance = route.originalRoute.distance;

    return {
      currentIndex,
      distanceRemaining,
      durationRemaining,
      fractionCompleted: distanceTraveled / totalDistance
    };
  }

  private getNextInstruction(route: CachedRoute, currentIndex: number) {
    // Find next instruction after current position
    for (let i = currentIndex; i < route.compactSegments.length; i++) {
      const segment = route.compactSegments[i];
      if (segment.instructionIndex !== undefined) {
        const instruction = route.instructions[segment.instructionIndex];
        const remainingDistance = route.compactSegments
          .slice(currentIndex, i)
          .reduce((sum, seg) => sum + seg.distance, 0);

        return {
          text: instruction.text,
          distance: remainingDistance,
          type: instruction.type
        };
      }
    }

    return {
      text: 'Continue straight',
      distance: 0,
      type: 'continue'
    };
  }

  private shouldReroute(
    currentSegment: CompactRouteSegment,
    actualLocation: [number, number]
  ): boolean {
    const deviationDistance = this.haversineDistance(
      currentSegment.coordinates,
      actualLocation
    );

    // Reroute if more than 50 meters off route
    return deviationDistance > 50;
  }

  private haversineDistance(coord1: [number, number], coord2: [number, number]): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = coord1[1] * Math.PI/180;
    const φ2 = coord2[1] * Math.PI/180;
    const Δφ = (coord2[1]-coord1[1]) * Math.PI/180;
    const Δλ = (coord2[0]-coord1[0]) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  async endOptimizedNavigation(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
    this.logger.debug(`Optimized navigation session ended: ${sessionId}`);
  }
}