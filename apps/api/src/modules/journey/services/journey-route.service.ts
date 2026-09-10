import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JourneyRouteRecord,
  JourneyRouteInactiveError,
  JourneyRouteRepository,
  JourneyRouteVersionConflictError,
} from '../../../database/repositories/journey-route.repository';
import { JourneyRepository } from '../../../database/repositories/journey.repository';
import { MapsService } from '../../maps/services/maps.service';
import { LocationGateway } from '../../location/location.gateway';
import { LoggerService } from '../../../shared/logger/logger.service';
import { UpsertJourneyRouteDto } from '../dto/upsert-journey-route.dto';
import { ApplySavedRouteDto } from '../../saved-routes/dto/saved-route.dto';
import { SavedRoutesService } from '../../saved-routes/saved-routes.service';
import { ParticipantService } from './participant.service';

@Injectable()
export class JourneyRouteService {
  constructor(
    private readonly routeRepository: JourneyRouteRepository,
    private readonly journeyRepository: JourneyRepository,
    private readonly participantService: ParticipantService,
    private readonly mapsService: MapsService,
    @Inject(forwardRef(() => LocationGateway))
    private readonly locationGateway: LocationGateway,
    private readonly logger: LoggerService,
    private readonly savedRoutesService: SavedRoutesService,
  ) {}

  async getCurrent(
    journeyId: string,
    userId: string,
  ): Promise<JourneyRouteRecord | null> {
    const journey = await this.journeyRepository.findById(journeyId);
    if (!journey) throw new NotFoundException('Journey not found');

    const isParticipant = await this.participantService.isParticipant(
      journeyId,
      userId,
    );
    if (!isParticipant) {
      throw new ForbiddenException('Not a participant of this journey');
    }

    return this.routeRepository.findCurrent(journeyId);
  }

  async replaceCurrent(
    journeyId: string,
    userId: string,
    dto: UpsertJourneyRouteDto,
  ): Promise<JourneyRouteRecord> {
    const journey = await this.journeyRepository.findById(journeyId);
    if (!journey) throw new NotFoundException('Journey not found');
    if (journey.leaderId !== userId) {
      throw new ForbiddenException(
        'Only the leader can update the canonical route',
      );
    }
    if (journey.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Canonical routes can only be updated for active journeys',
      );
    }
    if (!journey.destination) {
      throw new BadRequestException('Journey has no destination');
    }

    // Return a committed result before checking baseVersion or calling Mapbox:
    // a retry whose first response was lost must not create a new route.
    const duplicate = await this.routeRepository.findByRequestId(
      journeyId,
      dto.requestId,
    );
    if (duplicate) return duplicate;

    const current = await this.routeRepository.findCurrent(journeyId);
    const currentVersion = current?.version ?? 0;
    if (currentVersion !== dto.baseVersion) {
      throw this.versionConflict(currentVersion);
    }
    if (currentVersion === 0 && dto.reason !== 'INITIAL') {
      throw new BadRequestException(
        'The first canonical route must use the INITIAL reason',
      );
    }
    if (currentVersion > 0 && dto.reason === 'INITIAL') {
      throw new BadRequestException(
        'INITIAL cannot replace an existing canonical route',
      );
    }

    const route = await this.mapsService.getRoute(
      dto.originLat,
      dto.originLng,
      journey.destination.latitude,
      journey.destination.longitude,
    );
    if (!route) {
      throw new BadGatewayException('No road route was found');
    }

    const routeIndex = dto.routeIndex ?? 0;
    const selectedRoute = [route, ...(route.alternates ?? [])][routeIndex];
    if (!selectedRoute) {
      throw new BadRequestException(
        `Route option ${routeIndex} is not available`,
      );
    }

    try {
      const saved = await this.routeRepository.replaceCurrent({
        journeyId,
        baseVersion: dto.baseVersion,
        coordinates: selectedRoute.coordinates,
        distanceMetres: selectedRoute.distanceMetres,
        durationSeconds: selectedRoute.durationSeconds,
        steps: selectedRoute.steps,
        origin: { latitude: dto.originLat, longitude: dto.originLng },
        destination: journey.destination,
        reason: dto.reason,
        createdBy: userId,
        requestId: dto.requestId,
      });
      try {
        await this.locationGateway.broadcastRouteUpdated(journeyId, {
          journeyId,
          routeVersion: saved.version,
          reason: saved.reason,
          updatedAt: saved.createdAt.toISOString(),
        });
      } catch (error) {
        // The route is already committed. Snapshot reconciliation guarantees
        // convergence even if this best-effort low-latency signal fails.
        this.logger.error(
          `Route update broadcast failed for journey ${journeyId}`,
          error instanceof Error ? error.stack : undefined,
          'JourneyRouteService',
          { journeyId, routeVersion: saved.version },
        );
      }
      return saved;
    } catch (error) {
      if (error instanceof JourneyRouteInactiveError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof JourneyRouteVersionConflictError) {
        throw this.versionConflict(error.currentVersion);
      }
      throw error;
    }
  }

  async replaceFromSavedRoute(
    journeyId: string,
    savedRouteId: string,
    userId: string,
    dto: ApplySavedRouteDto,
  ): Promise<JourneyRouteRecord> {
    const journey = await this.journeyRepository.findById(journeyId);
    if (!journey) throw new NotFoundException('Journey not found');
    if (journey.leaderId !== userId) {
      throw new ForbiddenException(
        'Only the leader can update the canonical route',
      );
    }
    if (journey.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Canonical routes can only be updated for active journeys',
      );
    }
    if (!journey.destination) {
      throw new BadRequestException('Journey has no destination');
    }

    const savedRoute = await this.savedRoutesService.findAvailableForJourney(
      savedRouteId,
      userId,
    );
    if (savedRoute.organizationId !== journey.organizationId) {
      throw new ForbiddenException(
        'Saved route and journey must belong to the same organization',
      );
    }
    const finalWaypoint = savedRoute.waypoints.at(-1);
    if (
      !finalWaypoint ||
      pointDistanceMetres(finalWaypoint, journey.destination) > 150
    ) {
      throw new BadRequestException(
        'Saved route destination does not match the journey destination',
      );
    }

    const duplicate = await this.routeRepository.findByRequestId(
      journeyId,
      dto.requestId,
    );
    if (duplicate) return duplicate;

    const current = await this.routeRepository.findCurrent(journeyId);
    const currentVersion = current?.version ?? 0;
    if (currentVersion !== dto.baseVersion) {
      throw this.versionConflict(currentVersion);
    }

    try {
      const route = await this.routeRepository.replaceCurrent({
        journeyId,
        baseVersion: dto.baseVersion,
        coordinates: savedRoute.geometry,
        distanceMetres: savedRoute.distanceMetres,
        durationSeconds: savedRoute.durationSeconds ?? 0,
        steps: savedRoute.steps,
        origin: savedRoute.waypoints[0],
        destination: journey.destination,
        reason: currentVersion === 0 ? 'INITIAL' : 'LEADER_REROUTE',
        createdBy: userId,
        requestId: dto.requestId,
      });
      await this.broadcastSavedRoute(journeyId, route);
      return route;
    } catch (error) {
      if (error instanceof JourneyRouteInactiveError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof JourneyRouteVersionConflictError) {
        throw this.versionConflict(error.currentVersion);
      }
      throw error;
    }
  }

  private async broadcastSavedRoute(
    journeyId: string,
    route: JourneyRouteRecord,
  ) {
    try {
      await this.locationGateway.broadcastRouteUpdated(journeyId, {
        journeyId,
        routeVersion: route.version,
        reason: route.reason,
        updatedAt: route.createdAt.toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Saved route broadcast failed for journey ${journeyId}`,
        error instanceof Error ? error.stack : undefined,
        'JourneyRouteService',
        { journeyId, routeVersion: route.version },
      );
    }
  }

  private versionConflict(currentVersion: number): ConflictException {
    return new ConflictException({
      statusCode: 409,
      code: 'ROUTE_VERSION_CONFLICT',
      message: 'The canonical route has changed',
      currentVersion,
    });
  }
}

function pointDistanceMetres(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const lat1 = radians(first.latitude);
  const lat2 = radians(second.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLng = radians(second.longitude - first.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
