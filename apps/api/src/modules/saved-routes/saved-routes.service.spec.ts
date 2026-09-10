import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { CreateSavedRouteRecord } from '../../database/repositories/saved-route.repository';
import { SavedRoutesService, pathDistanceMetres } from './saved-routes.service';

describe('SavedRoutesService', () => {
  const organizationId = '11111111-1111-4111-8111-111111111111';
  const creatorId = 'creator-1';
  const now = new Date('2026-09-10T08:00:00Z');
  const primary = {
    coordinates: [
      [36.8, -1.2],
      [36.9, -1.3],
    ],
    distanceMetres: 15000,
    durationSeconds: 1200,
    steps: [],
    alternates: [
      {
        coordinates: [
          [36.8, -1.2],
          [36.85, -1.24],
          [36.9, -1.3],
        ],
        distanceMetres: 16000,
        durationSeconds: 1100,
        steps: [],
      },
    ],
  };
  const baseDto = {
    name: 'Airstrip transfer',
    source: 'COMPUTED' as const,
    waypoints: [
      { latitude: -1.2, longitude: 36.8, name: 'Gate' },
      { latitude: -1.3, longitude: 36.9, name: 'Airstrip' },
    ],
  };

  let service: SavedRoutesService;
  let routes: {
    listByOrganization: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    archive: jest.Mock;
    isMobileEditor: jest.Mock;
    replaceMobileEditors: jest.Mock;
    listMobileEditorIds: jest.Mock;
  };
  let access: {
    findOrganizationForUser: jest.Mock;
    findActiveTeamMemberIds: jest.Mock;
    getAccess: jest.Mock;
  };
  let maps: { getRouteThrough: jest.Mock };
  let lastCreated: CreateSavedRouteRecord | undefined;

  beforeEach(() => {
    lastCreated = undefined;
    routes = {
      listByOrganization: jest.fn().mockResolvedValue([]),
      findById: jest.fn(),
      create: jest.fn().mockImplementation((input: CreateSavedRouteRecord) => {
        lastCreated = input;
        return Promise.resolve({
          id: '22222222-2222-4222-8222-222222222222',
          ...input,
          description: input.description ?? null,
          durationSeconds: input.durationSeconds ?? null,
          version: 1,
          createdByClerkUserId: null,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        });
      }),
      update: jest.fn(),
      archive: jest.fn().mockResolvedValue(true),
      isMobileEditor: jest.fn().mockResolvedValue(false),
      replaceMobileEditors: jest.fn().mockResolvedValue(undefined),
      listMobileEditorIds: jest.fn().mockResolvedValue([]),
    };
    access = {
      findOrganizationForUser: jest.fn().mockResolvedValue(organizationId),
      findActiveTeamMemberIds: jest
        .fn()
        .mockImplementation((_organizationId, ids: string[]) =>
          Promise.resolve(ids),
        ),
      getAccess: jest.fn(),
    };
    maps = { getRouteThrough: jest.fn().mockResolvedValue(primary) };
    service = new SavedRoutesService(
      routes as never,
      access as never,
      maps as never,
    );
  });

  it('persists the selected Valhalla alternative through every waypoint', async () => {
    await service.create(creatorId, {
      ...baseDto,
      routeIndex: 1,
      editorUserIds: ['editor-1'],
    });

    expect(maps.getRouteThrough).toHaveBeenCalledWith(baseDto.waypoints);
    expect(routes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        createdByUserId: creatorId,
        geometry: primary.alternates[0].coordinates,
        distanceMetres: 16000,
      }),
    );
    expect(routes.replaceMobileEditors).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      ['editor-1'],
      creatorId,
    );
  });

  it('calculates recorded distance without calling Valhalla', async () => {
    await service.create(creatorId, {
      name: 'Private track',
      source: 'RECORDED',
      waypoints: baseDto.waypoints,
      geometry: [
        { latitude: -1.2, longitude: 36.8 },
        { latitude: -1.201, longitude: 36.801 },
      ],
      recordedDurationSeconds: 60,
    });

    expect(maps.getRouteThrough).not.toHaveBeenCalled();
    const created = lastCreated;
    expect(created).toBeDefined();
    expect(created).toMatchObject({
      source: 'RECORDED',
      durationSeconds: 60,
      steps: [],
    });
    expect(created?.distanceMetres).toBeGreaterThan(100);
  });

  it('requires delegated edit permission for a non-creator', async () => {
    routes.findById.mockResolvedValue({
      id: 'route-1',
      organizationId,
      createdByUserId: creatorId,
      isArchived: false,
    });

    await expect(service.archive('route-1', 'member-2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(routes.archive).not.toHaveBeenCalled();
  });

  it('rejects editor identities outside the organization', async () => {
    access.findActiveTeamMemberIds.mockResolvedValue([]);

    await expect(
      service.create(creatorId, {
        ...baseDto,
        editorUserIds: ['outsider-1'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(routes.create).not.toHaveBeenCalled();
  });
});

describe('pathDistanceMetres', () => {
  it('measures a recorded path in metres', () => {
    expect(
      pathDistanceMetres([
        [36.8, -1.2],
        [36.8, -1.201],
      ]),
    ).toBeCloseTo(111.2, 0);
  });
});
