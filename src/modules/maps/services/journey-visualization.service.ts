import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from '../../../shared/firebase/firebase.service';
import { RedisService } from '../../../shared/redis/redis.service';
import { MatrixService } from './matrix.service';
import { RoutingService } from './routing.service';
import { 
  JourneyVisualizationRequestDto,
  JourneyVisualizationResponseDto,
  DriverLocationDto,
  DriverTrackingDto,
  DriverTrackingResponseDto,
  DriverStatus
} from '../dto/journey-visualization.dto';
import { ETA } from '../interfaces/mapbox.interface';

@Injectable()
export class JourneyVisualizationService {
  private readonly logger = new Logger(JourneyVisualizationService.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly redisService: RedisService,
    private readonly matrixService: MatrixService,
    private readonly routingService: RoutingService,
    private readonly configService: ConfigService
  ) {
    this.logger.log('Journey Visualization service initialized');
  }

  async getJourneyVisualization(
    userId: string,
    request: JourneyVisualizationRequestDto
  ): Promise<JourneyVisualizationResponseDto> {
    this.logger.debug(`Getting journey visualization for journey: ${request.journeyId}`);

    // 1. Validate access to journey
    await this.validateJourneyAccess(userId, request.journeyId);

    // 2. Get journey details
    const journey = await this.getJourneyDetails(request.journeyId);

    // 3. Get all active participants
    const participants = await this.getActiveParticipants(request.journeyId);

    // 4. Get latest locations for all participants
    const driversWithLocations = await this.getDriversWithLocations(
      request.journeyId, 
      participants,
      request.includeETA || true
    );

    // 5. Filter by viewport if provided
    let filteredDrivers = driversWithLocations;
    if (request.viewport) {
      filteredDrivers = this.filterDriversByViewport(driversWithLocations, request.viewport);
    }

    // 6. Get route if requested
    let route;
    if (request.includeRoute && journey.destination) {
      route = await this.getJourneyRoute(
        driversWithLocations.find(d => d.role === 'LEADER')?.location || [0, 0],
        [journey.destination.longitude, journey.destination.latitude]
      );
    }

    return {
      journey: {
        id: request.journeyId,
        name: journey.name,
        status: journey.status,
        destination: {
          coordinates: [journey.destination.longitude, journey.destination.latitude],
          address: journey.destinationAddress || 'Unknown'
        }
      },
      drivers: filteredDrivers,
      route,
      metadata: {
        totalDrivers: driversWithLocations.length,
        activeDrivers: driversWithLocations.filter(d => d.status !== DriverStatus.OFFLINE).length,
        lastUpdate: new Date().toISOString(),
        refreshIntervalSeconds: 5
      }
    };
  }

  async trackSpecificDriver(
    userId: string,
    request: DriverTrackingDto
  ): Promise<DriverTrackingResponseDto> {
    // 1. Validate access
    await this.validateJourneyAccess(userId, request.journeyId);

    // 2. Get participant details
    const participant = await this.getParticipantDetails(request.journeyId, request.participantId);
    if (!participant) {
      throw new NotFoundException('Participant not found');
    }

    // 3. Get current location with user profile
    const driverLocation = await this.getDriverWithLocation(request.journeyId, participant, true);

    // 4. Get location history
    const locationHistory = await this.getParticipantLocationHistory(
      request.journeyId,
      request.participantId,
      request.historyCount || 5
    );

    // 5. Get route to destination if driver is actively navigating
    let routeToDestination;
    if (driverLocation.status === DriverStatus.NAVIGATING) {
      const journey = await this.getJourneyDetails(request.journeyId);
      if (journey.destination) {
        routeToDestination = await this.getJourneyRoute(
          driverLocation.location,
          [journey.destination.longitude, journey.destination.latitude]
        );
      }
    }

    return {
      driver: driverLocation,
      locationHistory,
      routeToDestination
    };
  }

  private async validateJourneyAccess(userId: string, journeyId: string): Promise<void> {
    const participantDoc = await this.firebaseService.firestore
      .collection('journeys')
      .doc(journeyId)
      .collection('participants')
      .doc(userId)
      .get();

    if (!participantDoc.exists) {
      throw new ForbiddenException('Not authorized to access this journey');
    }
  }

  private async getJourneyDetails(journeyId: string): Promise<any> {
    const journeyDoc = await this.firebaseService.firestore
      .collection('journeys')
      .doc(journeyId)
      .get();

    if (!journeyDoc.exists) {
      throw new NotFoundException('Journey not found');
    }

    return { id: journeyDoc.id, ...journeyDoc.data() };
  }

  private async getActiveParticipants(journeyId: string): Promise<any[]> {
    const participantsSnapshot = await this.firebaseService.firestore
      .collection('journeys')
      .doc(journeyId)
      .collection('participants')
      .where('status', 'in', ['ACTIVE', 'INVITED'])
      .get();

    return participantsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  private async getDriversWithLocations(
    journeyId: string,
    participants: any[],
    includeETA: boolean = true
  ): Promise<DriverLocationDto[]> {
    const drivers: DriverLocationDto[] = [];

    for (const participant of participants) {
      try {
        const driverLocation = await this.getDriverWithLocation(journeyId, participant, includeETA);
        if (driverLocation) {
          drivers.push(driverLocation);
        }
      } catch (error) {
        this.logger.warn(`Failed to get location for participant ${participant.id}:`, error);
        // Include offline driver
        const userProfile = await this.getUserProfile(participant.userId);
        drivers.push({
          participantId: participant.id,
          userId: participant.userId,
          displayName: userProfile?.displayName || 'Unknown User',
          photoURL: userProfile?.photoURL,
          location: [0, 0], // Default location
          heading: 0,
          speed: 0,
          status: DriverStatus.OFFLINE,
          lastUpdate: new Date().toISOString(),
          role: participant.role
        });
      }
    }

    return drivers;
  }

  private async getDriverWithLocation(
    journeyId: string,
    participant: any,
    includeETA: boolean = true
  ): Promise<DriverLocationDto> {
    // Get latest location from Redis cache
    const cachedLocation = await this.redisService.getCachedLocation(journeyId, participant.userId);
    
    // Get user profile
    const userProfile = await this.getUserProfile(participant.userId);

    let etaSeconds, distanceToDestination;
    
    if (includeETA && cachedLocation) {
      try {
        // Get journey destination
        const journey = await this.getJourneyDetails(journeyId);
        if (journey.destination) {
          const eta = await this.matrixService.getDistanceBetweenPoints(
            [cachedLocation.longitude, cachedLocation.latitude],
            [journey.destination.longitude, journey.destination.latitude],
            'driving-traffic'
          );
          etaSeconds = eta.duration;
          distanceToDestination = eta.distance;
        }
      } catch (error) {
        this.logger.warn('Failed to calculate ETA:', error);
      }
    }

    // Determine driver status
    const status = this.determineDriverStatus(cachedLocation, participant);

    return {
      participantId: participant.id,
      userId: participant.userId,
      displayName: userProfile?.displayName || 'Unknown User',
      photoURL: userProfile?.photoURL,
      location: cachedLocation ? [cachedLocation.longitude, cachedLocation.latitude] : [0, 0],
      heading: cachedLocation?.heading || 0,
      speed: cachedLocation?.speed || 0,
      status,
      lastUpdate: cachedLocation?.timestamp || new Date().toISOString(),
      etaSeconds,
      distanceToDestination,
      role: participant.role,
      isLagging: false, // TODO: Implement lag detection
      batteryLevel: cachedLocation?.batteryLevel
    };
  }

  private async getUserProfile(userId: string): Promise<any> {
    try {
      const userDoc = await this.firebaseService.firestore
        .collection('users')
        .doc(userId)
        .get();
      
      return userDoc.exists ? userDoc.data() : null;
    } catch (error) {
      this.logger.warn(`Failed to get user profile for ${userId}:`, error);
      return null;
    }
  }

  private determineDriverStatus(location: any, participant: any): DriverStatus {
    if (!location) return DriverStatus.OFFLINE;
    
    // Check if location is recent (within last 30 seconds)
    const lastUpdate = new Date(location.timestamp);
    const now = new Date();
    const diffSeconds = (now.getTime() - lastUpdate.getTime()) / 1000;
    
    if (diffSeconds > 30) return DriverStatus.OFFLINE;
    if (location.speed > 1) return DriverStatus.NAVIGATING;
    
    return DriverStatus.ACTIVE;
  }

  private async getParticipantDetails(journeyId: string, participantId: string): Promise<any> {
    const participantDoc = await this.firebaseService.firestore
      .collection('journeys')
      .doc(journeyId)
      .collection('participants')
      .doc(participantId)
      .get();

    return participantDoc.exists ? { id: participantDoc.id, ...participantDoc.data() } : null;
  }

  private async getParticipantLocationHistory(
    journeyId: string,
    participantId: string,
    count: number
  ): Promise<Array<{ location: [number, number]; timestamp: string; speed: number; heading: number }>> {
    try {
      const historySnapshot = await this.firebaseService.firestore
        .collection('journeys')
        .doc(journeyId)
        .collection('locationHistory')
        .where('participantId', '==', participantId)
        .orderBy('timestamp', 'desc')
        .limit(count)
        .get();

      return historySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          location: [data.longitude, data.latitude],
          timestamp: data.timestamp.toDate?.()?.toISOString() || data.timestamp,
          speed: data.speed || 0,
          heading: data.heading || 0
        };
      });
    } catch (error) {
      this.logger.warn('Failed to get location history:', error);
      return [];
    }
  }

  private async getJourneyRoute(origin: [number, number], destination: [number, number]): Promise<any> {
    try {
      const route = await this.routingService.calculateRoute([origin, destination], {
        profile: 'driving-traffic',
        steps: true,
        geometries: 'geojson'
      });

      return {
        geometry: route.geometry,
        distance: route.distance,
        duration: route.duration,
        instructions: route.legs[0]?.steps?.map(step => step.instruction) || []
      };
    } catch (error) {
      this.logger.warn('Failed to calculate journey route:', error);
      return null;
    }
  }

  private filterDriversByViewport(
    drivers: DriverLocationDto[],
    viewport: [number, number, number, number]
  ): DriverLocationDto[] {
    const [minLng, minLat, maxLng, maxLat] = viewport;
    
    return drivers.filter(driver => {
      const [lng, lat] = driver.location;
      return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
    });
  }
}