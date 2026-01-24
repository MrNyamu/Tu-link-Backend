import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { LocationService } from './location.service';
import { LocationUpdateDto } from './dto/location-update.dto';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('locations')
@ApiBearerAuth()
@Controller('locations')
@UseGuards(FirebaseAuthGuard)
export class LocationController {
  constructor(private locationService: LocationService) {}

  /**
   * REST fallback endpoint for location updates
   * Use this when WebSocket is not available
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send location update (REST fallback)',
    description: `Send a location update via REST API when WebSocket is not available.

**Primary Method**: Use WebSocket connection for real-time location updates (preferred)
**Fallback Method**: Use this REST endpoint when WebSocket connection fails

**Rate Limiting**: 
- High-frequency updates (every 2-5 seconds) are throttled
- Only significant changes in location/speed are processed
- Sequence numbers ensure ordered processing

**Journey Tracking**:
- User must be an active participant in the journey
- Location is cached in Redis for real-time access
- Triggers lag detection if falling behind convoy
- Broadcasts updates to other journey participants

**Response**:
- \`success\`: true if location processed, false if throttled
- \`sequenceNumber\`: Order number for this update
- \`priority\`: Update priority (HIGH/NORMAL/LOW)`
  })
  @ApiResponse({
    status: 201,
    description: 'Location update processed successfully',
    schema: {
      example: {
        success: true,
        sequenceNumber: 142,
        priority: 'NORMAL',
        message: 'Location update processed successfully'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid location data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not a participant in any active journey' })
  @ApiResponse({ status: 429, description: 'Too many requests - location update throttled' })
  async createLocationUpdate(
    @CurrentUser('uid') userId: string,
    @Body() locationUpdateDto: LocationUpdateDto,
  ) {
    const result = await this.locationService.processLocationUpdate(
      userId,
      locationUpdateDto,
    );

    return {
      success: result.success,
      sequenceNumber: result.sequenceNumber,
      priority: result.priority,
      message: result.success
        ? 'Location update processed successfully'
        : 'Location update throttled',
    };
  }

  /**
   * Get location history for a journey
   */
  @Get('journeys/:journeyId/history')
  @ApiOperation({
    summary: 'Get location history for journey',
    description: `Retrieve location history for all participants in a journey.

**Access Control**:
- User must be a participant in the journey
- Only returns data from active/completed journeys

**Data Returned**:
- Chronologically ordered location updates
- Includes participant ID, coordinates, timestamp, speed, heading
- Cached data from Redis (recent) + historical data from Firestore
- Default limit: 100 updates

**Use Cases**:
- Journey replay and visualization
- Performance analysis and debugging
- Route optimization analysis`
  })
  @ApiParam({
    name: 'journeyId',
    description: 'Journey ID to get location history for',
    example: 'journey_abc123'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of location updates to return',
    example: 100
  })
  @ApiResponse({
    status: 200,
    description: 'Location history retrieved successfully',
    schema: {
      example: [
        {
          participantId: 'participant_123',
          userId: 'user_456',
          displayName: 'John Doe',
          latitude: 40.7589,
          longitude: -73.9851,
          heading: 45,
          speed: 25,
          timestamp: '2026-01-24T10:30:00.000Z',
          accuracy: 5.2
        }
      ]
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not authorized to access this journey' })
  @ApiResponse({ status: 404, description: 'Journey not found' })
  async getLocationHistory(
    @Param('journeyId') journeyId: string,
    @CurrentUser('uid') userId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.locationService.getLocationHistory(journeyId, userId, limit || 100);
  }

  /**
   * Get latest locations for all participants in a journey
   */
  @Get('journeys/:journeyId/latest')
  @ApiOperation({
    summary: 'Get latest locations for all journey participants',
    description: `Get the most recent location for each participant in a journey.

**Real-Time Data**:
- Returns cached locations from Redis (fastest access)
- Fallback to Firestore if Redis cache miss
- Includes participant status (ACTIVE, NAVIGATING, OFFLINE)

**Data Returned**:
- Latest location per participant
- User profile information (name, photo)
- Online status and last update time
- Speed, heading, and accuracy information

**Use Cases**:
- Real-time convoy tracking map
- Participant status dashboard
- Journey progress monitoring`
  })
  @ApiParam({
    name: 'journeyId',
    description: 'Journey ID to get latest locations for',
    example: 'journey_abc123'
  })
  @ApiResponse({
    status: 200,
    description: 'Latest locations retrieved successfully',
    schema: {
      example: {
        participants: [
          {
            participantId: 'participant_123',
            userId: 'user_456',
            displayName: 'John Doe',
            photoURL: 'https://example.com/photo.jpg',
            role: 'LEADER',
            status: 'NAVIGATING',
            location: {
              latitude: 40.7589,
              longitude: -73.9851,
              heading: 45,
              speed: 25,
              timestamp: '2026-01-24T10:30:00.000Z',
              accuracy: 5.2
            }
          }
        ]
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not authorized to access this journey' })
  @ApiResponse({ status: 404, description: 'Journey not found' })
  async getLatestLocations(
    @Param('journeyId') journeyId: string,
    @CurrentUser('uid') userId: string,
  ) {
    return this.locationService.getLatestLocations(journeyId, userId);
  }

  /**
   * Get location history for a specific participant
   */
  @Get('journeys/:journeyId/participants/:participantId/history')
  @ApiOperation({
    summary: 'Get location history for specific participant',
    description: `Get location history for a specific participant in a journey.

**Detailed Tracking**:
- Individual participant's complete location trail
- Useful for detailed analysis and debugging
- Shows journey route and timing patterns

**Privacy & Access**:
- User must be in the same journey to access data
- Leaders can access all participant data
- Participants can access their own data

**Data Quality**:
- Filtered for accuracy and consistency
- Removes duplicate/invalid coordinates
- Ordered chronologically for route analysis

**Analytics Use Cases**:
- Individual driver performance analysis
- Route deviation detection
- Speed pattern analysis
- Journey completion tracking`
  })
  @ApiParam({
    name: 'journeyId',
    description: 'Journey ID containing the participant',
    example: 'journey_abc123'
  })
  @ApiParam({
    name: 'participantId',
    description: 'Participant ID to get location history for',
    example: 'participant_456'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of location updates to return',
    example: 50
  })
  @ApiResponse({
    status: 200,
    description: 'Participant location history retrieved successfully',
    schema: {
      example: {
        participantId: 'participant_456',
        userId: 'user_789',
        displayName: 'Jane Smith',
        role: 'FOLLOWER',
        locationHistory: [
          {
            latitude: 40.7589,
            longitude: -73.9851,
            heading: 45,
            speed: 25,
            timestamp: '2026-01-24T10:30:00.000Z',
            accuracy: 5.2,
            sequenceNumber: 142
          }
        ],
        totalPoints: 1,
        journeyDuration: '00:45:30',
        distanceTraveled: 12.5
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not authorized to access this participant data' })
  @ApiResponse({ status: 404, description: 'Journey or participant not found' })
  async getParticipantLocationHistory(
    @Param('journeyId') journeyId: string,
    @Param('participantId') participantId: string,
    @CurrentUser('uid') userId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.locationService.getParticipantLocationHistory(
      journeyId,
      participantId,
      userId,
      limit || 50,
    );
  }
}
