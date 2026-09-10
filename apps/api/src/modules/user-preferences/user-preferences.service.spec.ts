import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserPreferencesService } from './user-preferences.service';

describe('UserPreferencesService', () => {
  const updatedAt = new Date('2026-09-10T12:00:00Z');
  let users: { findById: jest.Mock; update: jest.Mock };
  let service: UserPreferencesService;

  beforeEach(() => {
    users = {
      findById: jest.fn(),
      update: jest.fn(),
    };
    service = new UserPreferencesService(users as never);
  });

  it('returns both stored preferences', async () => {
    users.findById.mockResolvedValue({
      followLeaderByDefault: false,
      voiceNavigationEnabled: true,
      updatedAt,
    });

    await expect(service.get('user-1')).resolves.toEqual({
      followLeaderByDefault: false,
      voiceNavigationEnabled: true,
      updatedAt,
    });
  });

  it('updates only the supplied preference', async () => {
    users.update.mockResolvedValue({
      followLeaderByDefault: true,
      voiceNavigationEnabled: false,
      updatedAt,
    });

    await expect(
      service.update('user-1', { voiceNavigationEnabled: false }),
    ).resolves.toEqual({
      followLeaderByDefault: true,
      voiceNavigationEnabled: false,
      updatedAt,
    });
    expect(users.update).toHaveBeenCalledWith('user-1', {
      voiceNavigationEnabled: false,
    });
  });

  it('rejects an empty update', async () => {
    await expect(service.update('user-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(users.update).not.toHaveBeenCalled();
  });

  it('returns not found when the user row is missing', async () => {
    users.findById.mockResolvedValue(null);
    await expect(service.get('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
