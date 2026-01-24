import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import matrix from '@mapbox/mapbox-sdk/services/matrix';
import { MapboxService } from './mapbox.service';
import { 
  DistanceMatrix, 
  MatrixOptions,
  ETA,
  CacheOptions 
} from '../interfaces/mapbox.interface';

@Injectable()
export class MatrixService {
  private readonly logger = new Logger(MatrixService.name);
  private readonly matrixClient: ReturnType<typeof matrix>;
  private readonly cacheTTL: Record<string, number>;

  constructor(
    private readonly mapboxService: MapboxService,
    private readonly configService: ConfigService
  ) {
    const config = this.configService.get('maps');
    this.cacheTTL = config.cacheTTL;
    
    this.matrixClient = matrix({
      accessToken: config.mapboxAccessToken
    });

    this.logger.log('Matrix service initialized');
  }

  async getDistanceMatrix(
    origins: [number, number][],
    destinations: [number, number][],
    options: MatrixOptions = {}
  ): Promise<DistanceMatrix> {
    if (!origins?.length || !destinations?.length) {
      throw new Error('Origins and destinations cannot be empty');
    }

    // Validate Mapbox Matrix API limits
    const totalCoordinates = origins.length + destinations.length;
    if (totalCoordinates > 25) {
      return this.handleLargeMatrix(origins, destinations, options);
    }

    // Validate coordinates
    [...origins, ...destinations].forEach(([lng, lat], index) => {
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error(`Invalid coordinates at index ${index}: [${lng}, ${lat}]`);
      }
    });

    const cacheKey = `matrix:${this.mapboxService.hashCoordinates([...origins, ...destinations], options)}`;
    const cacheOptions: CacheOptions = {
      key: cacheKey,
      ttl: this.cacheTTL.matrix,
      enabled: true
    };

    return this.mapboxService.makeRequest(
      async () => {
        this.logger.debug(`Calculating distance matrix: ${origins.length} origins × ${destinations.length} destinations`);

        const coordinates = [...origins, ...destinations];
        const sources = origins.map((_, i) => i);
        const destinationsIndices = destinations.map((_, i) => origins.length + i);

        const requestOptions: any = {
          points: coordinates.map(coords => ({ coordinates: coords })),
          sources: sources,
          destinations: destinationsIndices,
          profile: options.profile ?? 'driving-traffic',
          annotations: options.annotations ?? ['distance', 'duration']
        };

        // Add optional parameters with correct names
        if (options.fallback_speed !== undefined) {
          requestOptions.fallbackSpeed = options.fallback_speed;
        }

        const response = await this.matrixClient
          .getMatrix(requestOptions)
          .send();

        const result: DistanceMatrix = {
          distances: response.body.distances || [],
          durations: response.body.durations || [],
          origins,
          destinations,
          sources: response.body.sources,
          destinations_points: response.body.destinations
        };

        this.logger.debug(`Matrix calculation completed: ${result.distances.length}×${result.distances[0]?.length} matrix`);
        return result;
      },
      cacheOptions,
      'matrix'
    );
  }

  private async handleLargeMatrix(
    origins: [number, number][],
    destinations: [number, number][],
    options: MatrixOptions
  ): Promise<DistanceMatrix> {
    this.logger.debug(`Large matrix detected (${origins.length + destinations.length} coordinates), splitting into chunks`);
    
    const maxOrigins = Math.min(20, 25 - destinations.length); // Conservative limit
    const originChunks = this.mapboxService.chunkArray(origins, maxOrigins);

    const allDistances: number[][] = [];
    const allDurations: number[][] = [];

    for (const [chunkIndex, originChunk] of originChunks.entries()) {
      this.logger.debug(`Processing chunk ${chunkIndex + 1}/${originChunks.length} with ${originChunk.length} origins`);
      
      const chunkMatrix = await this.getDistanceMatrix(originChunk, destinations, options);
      allDistances.push(...chunkMatrix.distances);
      allDurations.push(...chunkMatrix.durations);

      // Add delay between chunks to avoid rate limiting
      if (chunkIndex < originChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return {
      distances: allDistances,
      durations: allDurations,
      origins,
      destinations,
      sources: [],
      destinations_points: []
    };
  }

  async getETAs(
    participantLocations: Map<string, [number, number]>,
    destination: [number, number]
  ): Promise<Map<string, ETA>> {
    if (participantLocations.size === 0) {
      return new Map();
    }

    const origins = Array.from(participantLocations.values());
    const participantIds = Array.from(participantLocations.keys());

    this.logger.debug(`Calculating ETAs for ${participantIds.length} participants`);

    const matrix = await this.getDistanceMatrix(origins, [destination], {
      profile: 'driving-traffic',
      annotations: ['distance', 'duration']
    });

    const etas = new Map<string, ETA>();
    const calculatedAt = new Date();

    matrix.durations.forEach((row, index) => {
      const participantId = participantIds[index];
      const durationSeconds = row[0];
      const distanceMeters = matrix.distances[index][0];

      // Handle unreachable destinations
      if (durationSeconds === null || durationSeconds === undefined || durationSeconds < 0) {
        this.logger.warn(`Unreachable destination for participant ${participantId}`);
        return;
      }

      etas.set(participantId, {
        participantId,
        estimatedArrival: new Date(Date.now() + durationSeconds * 1000),
        durationSeconds,
        distanceMeters,
        calculatedAt,
        confidence: this.calculateETAConfidence(durationSeconds, distanceMeters)
      });
    });

    this.logger.debug(`ETAs calculated for ${etas.size}/${participantIds.length} participants`);
    return etas;
  }

  async getBatchETAs(
    participantGroups: Array<{
      groupId: string;
      participants: Map<string, [number, number]>;
      destination: [number, number];
    }>
  ): Promise<Map<string, Map<string, ETA>>> {
    const results = new Map<string, Map<string, ETA>>();

    this.logger.debug(`Processing batch ETAs for ${participantGroups.length} groups`);

    const promises = participantGroups.map(async group => {
      const etas = await this.getETAs(group.participants, group.destination);
      results.set(group.groupId, etas);
      return { groupId: group.groupId, count: etas.size };
    });

    const completed = await Promise.all(promises);
    completed.forEach(result => {
      this.logger.debug(`Group ${result.groupId}: ${result.count} ETAs calculated`);
    });

    return results;
  }

  async getDistanceBetweenPoints(
    origin: [number, number],
    destination: [number, number],
    profile: MatrixOptions['profile'] = 'driving-traffic'
  ): Promise<{ distance: number; duration: number }> {
    const matrix = await this.getDistanceMatrix([origin], [destination], { profile });
    
    return {
      distance: matrix.distances[0][0],
      duration: matrix.durations[0][0]
    };
  }

  async findNearestPoint(
    target: [number, number],
    candidates: [number, number][],
    profile: MatrixOptions['profile'] = 'driving-traffic'
  ): Promise<{ index: number; distance: number; duration: number; coordinates: [number, number] }> {
    if (candidates.length === 0) {
      throw new Error('No candidate points provided');
    }

    const matrix = await this.getDistanceMatrix([target], candidates, { profile });
    
    let nearestIndex = 0;
    let nearestDistance = matrix.distances[0][0];
    let nearestDuration = matrix.durations[0][0];

    matrix.distances[0].forEach((distance, index) => {
      if (distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
        nearestDuration = matrix.durations[0][index];
      }
    });

    return {
      index: nearestIndex,
      distance: nearestDistance,
      duration: nearestDuration,
      coordinates: candidates[nearestIndex]
    };
  }

  async calculateLagDistance(
    currentPosition: [number, number],
    expectedPosition: [number, number],
    profile: MatrixOptions['profile'] = 'driving-traffic'
  ): Promise<number> {
    const result = await this.getDistanceBetweenPoints(currentPosition, expectedPosition, profile);
    return result.distance;
  }

  async isWithinRadius(
    center: [number, number],
    point: [number, number],
    radiusMeters: number,
    profile: MatrixOptions['profile'] = 'driving-traffic'
  ): Promise<boolean> {
    const result = await this.getDistanceBetweenPoints(center, point, profile);
    return result.distance <= radiusMeters;
  }

  async rankByProximity(
    target: [number, number],
    points: Array<{ id: string; coordinates: [number, number] }>,
    profile: MatrixOptions['profile'] = 'driving-traffic'
  ): Promise<Array<{ id: string; coordinates: [number, number]; distance: number; duration: number; rank: number }>> {
    if (points.length === 0) {
      return [];
    }

    const coordinates = points.map(p => p.coordinates);
    const matrix = await this.getDistanceMatrix([target], coordinates, { profile });

    const ranked = points.map((point, index) => ({
      id: point.id,
      coordinates: point.coordinates,
      distance: matrix.distances[0][index],
      duration: matrix.durations[0][index],
      rank: 0
    }));

    // Sort by distance and assign ranks
    ranked.sort((a, b) => a.distance - b.distance);
    ranked.forEach((item, index) => {
      item.rank = index + 1;
    });

    this.logger.debug(`Ranked ${ranked.length} points by proximity to target`);
    return ranked;
  }

  private calculateETAConfidence(durationSeconds: number, distanceMeters: number): number {
    // Simple confidence calculation based on distance and traffic conditions
    // In a real implementation, this would consider traffic patterns, time of day, etc.
    
    if (distanceMeters < 1000) return 0.95; // High confidence for short distances
    if (distanceMeters < 5000) return 0.85; // Good confidence for medium distances
    if (distanceMeters < 20000) return 0.75; // Moderate confidence for longer distances
    return 0.65; // Lower confidence for very long distances
  }

  async getMatrixStatistics(matrix: DistanceMatrix): Promise<{
    totalDistance: number;
    averageDistance: number;
    totalDuration: number;
    averageDuration: number;
    maxDistance: number;
    maxDuration: number;
    minDistance: number;
    minDuration: number;
  }> {
    const allDistances = matrix.distances.flat().filter(d => d !== null && d !== undefined);
    const allDurations = matrix.durations.flat().filter(d => d !== null && d !== undefined);

    return {
      totalDistance: allDistances.reduce((sum, d) => sum + d, 0),
      averageDistance: allDistances.length > 0 ? allDistances.reduce((sum, d) => sum + d, 0) / allDistances.length : 0,
      totalDuration: allDurations.reduce((sum, d) => sum + d, 0),
      averageDuration: allDurations.length > 0 ? allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length : 0,
      maxDistance: allDistances.length > 0 ? Math.max(...allDistances) : 0,
      maxDuration: allDurations.length > 0 ? Math.max(...allDurations) : 0,
      minDistance: allDistances.length > 0 ? Math.min(...allDistances) : 0,
      minDuration: allDurations.length > 0 ? Math.min(...allDurations) : 0
    };
  }
}