import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('analytics')
@UseGuards(FirebaseAuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  /**
   * Get analytics for a specific journey
   */
  @Get('journeys/:id')
  async getJourneyAnalytics(@Param('id') id: string) {
    return this.analyticsService.getJourneyAnalytics(id);
  }

  /**
   * Get user's journey history with analytics
   */
  @Get('user')
  async getUserJourneyHistory(
    @CurrentUser('uid') userId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.analyticsService.getUserJourneyHistory(userId, limit || 20);
  }
}
