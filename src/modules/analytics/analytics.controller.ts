import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(FirebaseAuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  /**
   * Get analytics for a specific journey
   */
  @Get('journeys/:id')
  @ApiOperation({
    summary: 'Get journey analytics',
    description: `Get comprehensive analytics for a completed journey.

**Analytics Included**:
- **Distance**: Total distance traveled by convoy
- **Duration**: Total journey time and active driving time
- **Speed**: Average speed, max speed, and speed distribution
- **Efficiency**: Route efficiency vs. optimal route
- **Participants**: Individual participant statistics
- **Lag Events**: Incidents where participants fell behind
- **Route Adherence**: How closely participants followed the planned route

**Access Control**:
- User must have been a participant in the journey
- Analytics only available after journey completion
- Leaders get access to all participant data
- Followers get aggregated data + their own detailed stats

**Performance Metrics**:
- Total distance covered
- Average convoy speed
- Time spent waiting for lagging participants
- Fuel efficiency estimates
- Route optimization suggestions

**Use Cases**:
- Post-journey performance review
- Route optimization for future trips
- Identifying recurring lag patterns
- Driver coaching and improvement`
  })
  @ApiParam({
    name: 'id',
    description: 'Journey ID to get analytics for',
    example: 'journey_abc123'
  })
  @ApiResponse({
    status: 200,
    description: 'Journey analytics retrieved successfully',
    schema: {
      example: {
        journey: {
          id: 'journey_abc123',
          name: 'Weekend Road Trip',
          status: 'COMPLETED',
          startTime: '2026-01-24T09:00:00.000Z',
          endTime: '2026-01-24T14:30:00.000Z',
          totalDuration: '05:30:00'
        },
        metrics: {
          totalDistance: 245.7,
          averageSpeed: 52.3,
          maxSpeed: 78.5,
          activeTime: '04:45:30',
          waitTime: '00:44:30',
          routeEfficiency: 0.92,
          fuelEfficiency: 8.5
        },
        participants: [
          {
            participantId: 'participant_123',
            displayName: 'John Doe',
            role: 'LEADER',
            distance: 245.7,
            averageSpeed: 54.1,
            lagEvents: 0,
            routeAdherence: 0.98
          }
        ],
        events: {
          lagAlerts: 3,
          speedViolations: 1,
          routeDeviations: 2,
          arrivals: 4
        },
        routeOptimization: {
          suggestedImprovements: [
            'Consider alternative route via Highway 101 for 12% time savings',
            'Reduce speed in urban areas to improve convoy cohesion'
          ],
          potentialTimeSaving: '00:35:00'
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not authorized to access this journey' })
  @ApiResponse({ status: 404, description: 'Journey not found or not completed' })
  async getJourneyAnalytics(@Param('id') id: string) {
    return this.analyticsService.getJourneyAnalytics(id);
  }

  /**
   * Get user's journey history with analytics
   */
  @Get('user')
  @ApiOperation({
    summary: 'Get user journey history with analytics',
    description: `Get the current user's complete journey history with analytics summary.

**Journey History**:
- All journeys user participated in (as leader or follower)
- Chronologically ordered (most recent first)
- Includes journey status and basic metrics
- Shows role in each journey (LEADER/FOLLOWER)

**Analytics Summary**:
- Total journeys completed
- Total distance traveled across all journeys
- Average journey duration
- Leadership vs. follower statistics
- Performance trends over time

**Data Scope**:
- Personal data only (privacy-focused)
- Aggregated statistics for trend analysis
- Individual journey performance metrics
- Achievement and milestone tracking

**Pagination**:
- Default limit: 20 journeys
- Use limit parameter to control page size
- Results sorted by journey start date (descending)

**Use Cases**:
- Personal journey history review
- Performance tracking over time
- Achievement and milestone display
- Journey statistics dashboard`
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of journeys to return',
    example: 20
  })
  @ApiResponse({
    status: 200,
    description: 'User journey history retrieved successfully',
    schema: {
      example: {
        user: {
          userId: 'user_123',
          displayName: 'John Doe',
          memberSince: '2025-12-01T00:00:00.000Z'
        },
        summary: {
          totalJourneys: 15,
          totalDistance: 2847.3,
          totalDuration: '47:32:15',
          averageJourneyLength: 189.8,
          leaderJourneys: 8,
          followerJourneys: 7,
          completionRate: 0.93
        },
        journeys: [
          {
            id: 'journey_abc123',
            name: 'Weekend Road Trip',
            status: 'COMPLETED',
            role: 'LEADER',
            startTime: '2026-01-24T09:00:00.000Z',
            endTime: '2026-01-24T14:30:00.000Z',
            duration: '05:30:00',
            distance: 245.7,
            participants: 4,
            averageSpeed: 52.3,
            lagEvents: 2
          }
        ],
        achievements: [
          {
            type: 'DISTANCE_MILESTONE',
            name: '1000km Traveled',
            achievedDate: '2026-01-20T00:00:00.000Z',
            description: 'Traveled over 1000km in convoy journeys'
          }
        ],
        trends: {
          averageSpeedTrend: '+2.3',
          journeyFrequency: 'Increasing',
          leadershipGrowth: '+25%'
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserJourneyHistory(
    @CurrentUser('uid') userId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.analyticsService.getUserJourneyHistory(userId, limit || 20);
  }
}
