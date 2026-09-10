import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { UserPreferencesService } from './user-preferences.service';

@ApiTags('user-preferences')
@ApiBearerAuth('bearer')
@Controller('users/me/preferences')
@UseGuards(FirebaseAuthGuard)
export class UserPreferencesController {
  constructor(private readonly preferences: UserPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current user preferences' })
  @ApiResponse({ status: 200, description: 'Preferences retrieved' })
  get(@CurrentUser('uid') userId: string) {
    return this.preferences.get(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update one or more current user preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated' })
  update(
    @CurrentUser('uid') userId: string,
    @Body() dto: UpdateUserPreferencesDto,
  ) {
    return this.preferences.update(userId, dto);
  }
}
