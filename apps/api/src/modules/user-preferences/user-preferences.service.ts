import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from '../../database/repositories/users.repository';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';

export interface UserPreferencesResponse {
  followLeaderByDefault: boolean;
  voiceNavigationEnabled: boolean;
  updatedAt: Date;
}

@Injectable()
export class UserPreferencesService {
  constructor(private readonly users: UsersRepository) {}

  async get(userId: string): Promise<UserPreferencesResponse> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return this.toResponse(user);
  }

  async update(
    userId: string,
    preferences: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesResponse> {
    if (
      preferences.followLeaderByDefault === undefined &&
      preferences.voiceNavigationEnabled === undefined
    ) {
      throw new BadRequestException('At least one preference is required');
    }

    const user = await this.users.update(userId, preferences);
    if (!user) throw new NotFoundException('User not found');
    return this.toResponse(user);
  }

  private toResponse(user: {
    followLeaderByDefault: boolean;
    voiceNavigationEnabled: boolean;
    updatedAt: Date;
  }): UserPreferencesResponse {
    return {
      followLeaderByDefault: user.followLeaderByDefault,
      voiceNavigationEnabled: user.voiceNavigationEnabled,
      updatedAt: user.updatedAt,
    };
  }
}
