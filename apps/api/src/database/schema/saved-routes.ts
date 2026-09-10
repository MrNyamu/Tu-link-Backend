import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { savedRouteSourceEnum } from './enums';
import { organizations } from './organizations';
import { users } from './users';
import type { JourneyRouteStep } from './journey-routes';

export interface SavedRouteWaypoint {
  latitude: number;
  longitude: number;
  name?: string;
}

export const savedRoutes = pgTable(
  'saved_routes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    source: savedRouteSourceEnum('source').notNull(),
    geometry: jsonb('geometry').$type<number[][]>().notNull(),
    waypoints: jsonb('waypoints').$type<SavedRouteWaypoint[]>().notNull(),
    distanceMetres: doublePrecision('distance_metres').notNull(),
    durationSeconds: doublePrecision('duration_seconds'),
    steps: jsonb('steps').$type<JourneyRouteStep[]>().notNull().default([]),
    version: integer('version').notNull().default(1),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdByClerkUserId: text('created_by_clerk_user_id'),
    isArchived: boolean('is_archived').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_saved_routes_organization').on(
      t.organizationId,
      t.isArchived,
      t.updatedAt,
    ),
  ],
);

export const savedRouteEditors = pgTable(
  'saved_route_editors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    savedRouteId: uuid('saved_route_id')
      .notNull()
      .references(() => savedRoutes.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    clerkUserId: text('clerk_user_id'),
    grantedBy: text('granted_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('saved_route_editors_mobile_unique').on(t.savedRouteId, t.userId),
    unique('saved_route_editors_clerk_unique').on(
      t.savedRouteId,
      t.clerkUserId,
    ),
    index('idx_saved_route_editors_route').on(t.savedRouteId),
    check(
      'saved_route_editors_one_identity',
      sql`num_nonnulls(${t.userId}, ${t.clerkUserId}) = 1`,
    ),
  ],
);

export type SavedRouteRow = typeof savedRoutes.$inferSelect;
