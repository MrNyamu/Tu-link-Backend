import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ValhallaRoutingService } from './valhalla-routing.service';

describe('ValhallaRoutingService', () => {
  const configService = {
    get: jest.fn((key: string, fallback: unknown) => {
      if (key === 'maps.valhallaUrl') return 'https://valhalla.test/';
      if (key === 'maps.requestTimeoutMs') return 1000;
      return fallback;
    }),
  };
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let service: ValhallaRoutingService;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
    service = new ValhallaRoutingService(configService as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('normalizes the primary trip and its alternates', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            trip: trip(9.5, 700, 10),
            alternates: [{ trip: trip(10.2, 760, 15) }],
          }),
        ),
    } as Response);

    const result = await service.getRoute(-1.28, 36.82, -1.3, 36.85);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://valhalla.test/route',
      expect.objectContaining({ method: 'POST' }),
    );
    const request = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
    ) as { alternates: number; costing: string };
    expect(request).toMatchObject({ alternates: 2, costing: 'auto' });
    expect(result).toMatchObject({
      coordinates: [
        [36.82, -1.28],
        [36.85, -1.3],
      ],
      distanceMetres: 9500,
      durationSeconds: 700,
      steps: [
        {
          instruction: 'Turn right',
          distanceMetres: 500,
          maneuver: 'turn-right',
        },
      ],
    });
    expect(result?.alternates).toHaveLength(1);
    expect(result?.alternates?.[0].distanceMetres).toBe(10200);
  });

  it('keeps intermediate route points as through locations', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ trip: trip(9.5, 700, 10) })),
    } as Response);

    await service.getRouteThrough([
      { latitude: -1.28, longitude: 36.82 },
      { latitude: -1.29, longitude: 36.83 },
      { latitude: -1.3, longitude: 36.85 },
    ]);

    const request = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
    ) as { locations: Array<{ type: string }> };
    expect(request.locations.map(({ type }) => type)).toEqual([
      'break',
      'through',
      'break',
    ]);
  });

  it('returns null when Valhalla cannot find a path', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 400,
      text: () =>
        Promise.resolve(
          JSON.stringify({ error: 'No path could be found', error_code: 442 }),
        ),
    } as Response);

    await expect(
      service.getRoute(-1.28, 36.82, -1.3, 36.85),
    ).resolves.toBeNull();
  });

  it('maps other upstream failures to a safe 502 response', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('internal error'),
    } as Response);

    await expect(
      service.getRoute(-1.28, 36.82, -1.3, 36.85),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('rejects a malformed successful response', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('{}'),
    } as Response);

    await expect(
      service.getRoute(-1.28, 36.82, -1.3, 36.85),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('maps connection failures to a safe 503 response', async () => {
    fetchSpy.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(
      service.getRoute(-1.28, 36.82, -1.3, 36.85),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

function trip(length: number, time: number, maneuverType: number) {
  return {
    summary: { length, time },
    legs: [
      {
        shape: '~~bmA_aifeA~`f@_ry@',
        maneuvers: [
          {
            type: maneuverType,
            instruction: 'Turn right',
            length: 0.5,
            begin_shape_index: 0,
            end_shape_index: 1,
          },
        ],
      },
    ],
  };
}
