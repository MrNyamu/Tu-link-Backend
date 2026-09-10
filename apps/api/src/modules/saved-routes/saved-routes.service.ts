import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationAccessRepository } from '../../database/repositories/organization-access.repository';
import {
  SavedRouteRepository,
  type SavedRouteSource,
} from '../../database/repositories/saved-route.repository';
import type { JourneyRouteStep, SavedRouteRow } from '../../database/schema';
import { MapsService } from '../maps/services/maps.service';
import {
  CreateSavedRouteDto,
  UpdateSavedRouteDto,
} from './dto/saved-route.dto';

interface PreparedRoute {
  source: SavedRouteSource;
  geometry: number[][];
  waypoints: Array<{
    latitude: number;
    longitude: number;
    name?: string;
  }>;
  distanceMetres: number;
  durationSeconds?: number;
  steps: JourneyRouteStep[];
}

@Injectable()
export class SavedRoutesService {
  constructor(
    private readonly routes: SavedRouteRepository,
    private readonly organizationAccess: OrganizationAccessRepository,
    private readonly maps: MapsService,
  ) {}

  async list(userId: string) {
    const organizationId = await this.requireOrganization(userId);
    const routes = await this.routes.listByOrganization(organizationId);
    return Promise.all(routes.map((route) => this.toResponse(route, userId)));
  }

  async get(id: string, userId: string) {
    const organizationId = await this.requireOrganization(userId);
    const route = await this.requireVisible(id, organizationId);
    return this.toResponse(route, userId);
  }

  async create(userId: string, dto: CreateSavedRouteDto) {
    const organizationId = await this.requireOrganization(userId);
    const prepared = await this.prepare(dto);
    const editorIds = this.uniqueEditorIds(dto.editorUserIds, userId);
    await this.requireEditorsInOrganization(organizationId, editorIds);

    const route = await this.routes.create({
      organizationId,
      name: dto.name.trim(),
      description: dto.description?.trim() || undefined,
      ...prepared,
      createdByUserId: userId,
    });
    await this.routes.replaceMobileEditors(route.id, editorIds, userId);
    return this.toResponse(route, userId);
  }

  async update(id: string, userId: string, dto: UpdateSavedRouteDto) {
    const organizationId = await this.requireOrganization(userId);
    const current = await this.requireVisible(id, organizationId);
    await this.requireMobileEditor(current, userId);

    if (dto.editorUserIds != null && current.createdByUserId !== userId) {
      throw new ForbiddenException('Only the route creator can manage editors');
    }

    const prepared = await this.prepare(dto);
    const updated = await this.routes.update(
      id,
      organizationId,
      dto.expectedVersion,
      {
        name: dto.name.trim(),
        description: dto.description?.trim() || undefined,
        ...prepared,
      },
    );
    if (!updated) {
      const latest = await this.routes.findById(id);
      if (latest && latest.version !== dto.expectedVersion) {
        throw new ConflictException({
          code: 'SAVED_ROUTE_VERSION_CONFLICT',
          message: 'The saved route has changed',
          currentVersion: latest.version,
        });
      }
      throw new NotFoundException('Saved route not found');
    }

    if (dto.editorUserIds != null) {
      const editorIds = this.uniqueEditorIds(dto.editorUserIds, userId);
      await this.requireEditorsInOrganization(organizationId, editorIds);
      await this.routes.replaceMobileEditors(id, editorIds, userId);
    }
    return this.toResponse(updated, userId);
  }

  async replaceEditors(id: string, userId: string, editorUserIds: string[]) {
    const organizationId = await this.requireOrganization(userId);
    const route = await this.requireVisible(id, organizationId);
    if (route.createdByUserId !== userId) {
      throw new ForbiddenException('Only the route creator can manage editors');
    }
    const editorIds = this.uniqueEditorIds(editorUserIds, userId);
    await this.requireEditorsInOrganization(organizationId, editorIds);
    await this.routes.replaceMobileEditors(id, editorIds, userId);
    return this.toResponse(route, userId);
  }

  async archive(id: string, userId: string): Promise<void> {
    const organizationId = await this.requireOrganization(userId);
    const route = await this.requireVisible(id, organizationId);
    await this.requireMobileEditor(route, userId);
    if (!(await this.routes.archive(id, organizationId))) {
      throw new NotFoundException('Saved route not found');
    }
  }

  async findAvailableForJourney(id: string, userId: string) {
    const organizationId = await this.requireOrganization(userId);
    return this.requireVisible(id, organizationId);
  }

  async listForOperator(clerkOrgId: string, clerkUserId: string) {
    const access = await this.organizationAccess.getAccess(
      clerkOrgId,
      clerkUserId,
    );
    if (!access) {
      throw new ForbiddenException('Active organization membership required');
    }
    return this.routes.listByOrganization(access.organizationId);
  }

  async createForOperator(
    clerkOrgId: string,
    clerkUserId: string,
    dto: CreateSavedRouteDto,
  ) {
    const organizationId = await this.requireOperatorManager(
      clerkOrgId,
      clerkUserId,
    );
    const prepared = await this.prepare(dto);
    return this.routes.create({
      organizationId,
      name: dto.name.trim(),
      description: dto.description?.trim() || undefined,
      ...prepared,
      createdByClerkUserId: clerkUserId,
    });
  }

  async updateForOperator(
    id: string,
    clerkOrgId: string,
    clerkUserId: string,
    dto: UpdateSavedRouteDto,
  ) {
    const organizationId = await this.requireOperatorManager(
      clerkOrgId,
      clerkUserId,
    );
    await this.requireVisible(id, organizationId);
    const prepared = await this.prepare(dto);
    const updated = await this.routes.update(
      id,
      organizationId,
      dto.expectedVersion,
      {
        name: dto.name.trim(),
        description: dto.description?.trim() || undefined,
        ...prepared,
      },
    );
    if (!updated) {
      const latest = await this.routes.findById(id);
      throw new ConflictException({
        code: 'SAVED_ROUTE_VERSION_CONFLICT',
        message: 'The saved route has changed',
        currentVersion: latest?.version,
      });
    }
    return updated;
  }

  async archiveForOperator(
    id: string,
    clerkOrgId: string,
    clerkUserId: string,
  ) {
    const organizationId = await this.requireOperatorManager(
      clerkOrgId,
      clerkUserId,
    );
    await this.requireVisible(id, organizationId);
    await this.routes.archive(id, organizationId);
  }

  private async prepare(dto: CreateSavedRouteDto): Promise<PreparedRoute> {
    const waypoints = dto.waypoints.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      ...(point.name?.trim() ? { name: point.name.trim() } : {}),
    }));

    if (dto.source === 'COMPUTED') {
      const result = await this.maps.getRouteThrough(waypoints);
      if (!result) throw new BadGatewayException('No road route was found');
      const route = [result, ...(result.alternates ?? [])][dto.routeIndex ?? 0];
      if (!route)
        throw new BadRequestException('Route option is not available');
      return {
        source: dto.source,
        geometry: route.coordinates,
        waypoints,
        distanceMetres: route.distanceMetres,
        durationSeconds: route.durationSeconds,
        steps: route.steps,
      };
    }

    if (!dto.geometry || dto.geometry.length < 2) {
      throw new BadRequestException(
        'Recorded and manual routes require at least two geometry points',
      );
    }
    const geometry = dto.geometry.map(({ longitude, latitude }) => [
      longitude,
      latitude,
    ]);
    return {
      source: dto.source,
      geometry,
      waypoints,
      distanceMetres: pathDistanceMetres(geometry),
      durationSeconds: dto.recordedDurationSeconds,
      steps: [],
    };
  }

  private async requireOrganization(userId: string): Promise<string> {
    const organizationId =
      await this.organizationAccess.findOrganizationForUser(userId);
    if (!organizationId) {
      throw new ForbiddenException('Organization membership required');
    }
    return organizationId;
  }

  private async requireOperatorManager(
    clerkOrgId: string,
    clerkUserId: string,
  ): Promise<string> {
    const access = await this.organizationAccess.getAccess(
      clerkOrgId,
      clerkUserId,
    );
    if (!access?.canManage) {
      throw new ForbiddenException('Organization admin role required');
    }
    return access.organizationId;
  }

  private async requireVisible(id: string, organizationId: string) {
    const route = await this.routes.findById(id);
    if (!route || route.organizationId !== organizationId || route.isArchived) {
      throw new NotFoundException('Saved route not found');
    }
    return route;
  }

  private async requireMobileEditor(route: SavedRouteRow, userId: string) {
    if (
      route.createdByUserId !== userId &&
      !(await this.routes.isMobileEditor(route.id, userId))
    ) {
      throw new ForbiddenException('Saved route edit permission required');
    }
  }

  private uniqueEditorIds(ids: string[] | undefined, creatorId: string) {
    return [...new Set(ids ?? [])].filter((id) => id !== creatorId);
  }

  private async requireEditorsInOrganization(
    organizationId: string,
    userIds: string[],
  ) {
    const active = await this.organizationAccess.findActiveTeamMemberIds(
      organizationId,
      userIds,
    );
    if (active.length !== userIds.length) {
      throw new BadRequestException(
        'Every route editor must be an active organization member',
      );
    }
  }

  private async toResponse(route: SavedRouteRow, userId: string) {
    const [canEditAsDelegate, editorUserIds] = await Promise.all([
      this.routes.isMobileEditor(route.id, userId),
      this.routes.listMobileEditorIds(route.id),
    ]);
    return {
      ...route,
      canEdit: route.createdByUserId === userId || canEditAsDelegate,
      editorUserIds,
    };
  }
}

export function pathDistanceMetres(coordinates: number[][]): number {
  let total = 0;
  for (let index = 1; index < coordinates.length; index++) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    const lat1 = radians(previous[1]);
    const lat2 = radians(current[1]);
    const deltaLat = lat2 - lat1;
    const deltaLng = radians(current[0] - previous[0]);
    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    total += 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

function radians(value: number): number {
  return (value * Math.PI) / 180;
}
