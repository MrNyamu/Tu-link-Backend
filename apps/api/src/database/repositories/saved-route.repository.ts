import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { DatabaseService } from '../database.service';
import {
  savedRouteEditors,
  savedRoutes,
  type JourneyRouteStep,
  type SavedRouteRow,
  type SavedRouteWaypoint,
} from '../schema';

export type SavedRouteSource = 'COMPUTED' | 'RECORDED' | 'MANUAL';

export interface CreateSavedRouteRecord {
  organizationId: string;
  name: string;
  description?: string;
  source: SavedRouteSource;
  geometry: number[][];
  waypoints: SavedRouteWaypoint[];
  distanceMetres: number;
  durationSeconds?: number;
  steps: JourneyRouteStep[];
  createdByUserId?: string;
  createdByClerkUserId?: string;
}

export interface UpdateSavedRouteRecord {
  name: string;
  description?: string;
  source: SavedRouteSource;
  geometry: number[][];
  waypoints: SavedRouteWaypoint[];
  distanceMetres: number;
  durationSeconds?: number;
  steps: JourneyRouteStep[];
}

@Injectable()
export class SavedRouteRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private get db() {
    return this.databaseService.db;
  }

  async listByOrganization(organizationId: string): Promise<SavedRouteRow[]> {
    return this.db
      .select()
      .from(savedRoutes)
      .where(
        and(
          eq(savedRoutes.organizationId, organizationId),
          eq(savedRoutes.isArchived, false),
        ),
      )
      .orderBy(desc(savedRoutes.updatedAt));
  }

  async findById(id: string): Promise<SavedRouteRow | null> {
    const [route] = await this.db
      .select()
      .from(savedRoutes)
      .where(eq(savedRoutes.id, id))
      .limit(1);
    return route ?? null;
  }

  async create(input: CreateSavedRouteRecord): Promise<SavedRouteRow> {
    const [route] = await this.db
      .insert(savedRoutes)
      .values({
        ...input,
        description: input.description ?? null,
        durationSeconds: input.durationSeconds ?? null,
      })
      .returning();
    return route;
  }

  async update(
    id: string,
    organizationId: string,
    expectedVersion: number,
    input: UpdateSavedRouteRecord,
  ): Promise<SavedRouteRow | null> {
    const [route] = await this.db
      .update(savedRoutes)
      .set({
        ...input,
        description: input.description ?? null,
        durationSeconds: input.durationSeconds ?? null,
        version: sql`${savedRoutes.version} + 1`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(savedRoutes.id, id),
          eq(savedRoutes.organizationId, organizationId),
          eq(savedRoutes.version, expectedVersion),
          eq(savedRoutes.isArchived, false),
        ),
      )
      .returning();
    return route ?? null;
  }

  async archive(id: string, organizationId: string): Promise<boolean> {
    const [route] = await this.db
      .update(savedRoutes)
      .set({ isArchived: true, updatedAt: sql`now()` })
      .where(
        and(
          eq(savedRoutes.id, id),
          eq(savedRoutes.organizationId, organizationId),
          eq(savedRoutes.isArchived, false),
        ),
      )
      .returning({ id: savedRoutes.id });
    return route != null;
  }

  async isMobileEditor(routeId: string, userId: string): Promise<boolean> {
    const [editor] = await this.db
      .select({ id: savedRouteEditors.id })
      .from(savedRouteEditors)
      .where(
        and(
          eq(savedRouteEditors.savedRouteId, routeId),
          eq(savedRouteEditors.userId, userId),
        ),
      )
      .limit(1);
    return editor != null;
  }

  async replaceMobileEditors(
    routeId: string,
    userIds: string[],
    grantedBy: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(savedRouteEditors)
        .where(
          and(
            eq(savedRouteEditors.savedRouteId, routeId),
            sql`${savedRouteEditors.userId} IS NOT NULL`,
          ),
        );
      if (userIds.length > 0) {
        await tx.insert(savedRouteEditors).values(
          userIds.map((userId) => ({
            savedRouteId: routeId,
            userId,
            grantedBy,
          })),
        );
      }
    });
  }

  async listMobileEditorIds(routeId: string): Promise<string[]> {
    const editors = await this.db
      .select({ userId: savedRouteEditors.userId })
      .from(savedRouteEditors)
      .where(
        and(
          eq(savedRouteEditors.savedRouteId, routeId),
          sql`${savedRouteEditors.userId} IS NOT NULL`,
        ),
      );
    return editors
      .map(({ userId }) => userId)
      .filter((userId): userId is string => userId != null);
  }

  async removeMobileEditors(routeId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    await this.db
      .delete(savedRouteEditors)
      .where(
        and(
          eq(savedRouteEditors.savedRouteId, routeId),
          inArray(savedRouteEditors.userId, userIds),
        ),
      );
  }
}
