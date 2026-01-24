import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GeocodingService } from './services/geocoding.service';
import { RoutingService } from './services/routing.service';
import { MatrixService } from './services/matrix.service';
import { NavigationService } from './services/navigation.service';
import { OptimizedNavigationService } from './services/optimized-navigation.service';
import { JourneyVisualizationService } from './services/journey-visualization.service';
import { MapboxService } from './services/mapbox.service';

// Import DTOs
import {
  GeocodeSearchDto,
  ReverseGeocodeDto,
  BatchGeocodeDto,
  PlaceDetailsDto,
  SearchNearbyDto,
  AutocompleteDto
} from './dto/geocoding.dto';

import {
  CalculateRouteDto,
  AlternativeRoutesDto,
  OptimizeRouteDto,
  TrafficRouteDto,
  RouteMatchDto,
  RouteEtaDto,
  BatchRoutesDto
} from './dto/routing.dto';

import {
  DistanceMatrixDto,
  JourneyEtaDto,
  BatchEtaDto,
  DistanceBetweenDto,
  FindNearestDto,
  LagDistanceDto,
  RadiusCheckDto,
  RankByProximityDto
} from './dto/matrix.dto';

import {
  StartNavigationDto,
  UpdateNavigationDto,
  VoiceInstructionsDto,
  NavigationSessionParamsDto,
  NavigationControlDto,
  NavigationSessionResponseDto,
  NavigationUpdateResponseDto,
  NavigationSummaryResponseDto,
  VoiceInstructionResponseDto,
  NavigationStatsResponseDto
} from './dto/navigation.dto';

import {
  CompactRouteDto,
  NavigationChunkRequestDto,
  NavigationChunkResponseDto,
  NavigationUpdateOptimizedDto,
  ProgressiveNavigationResponseDto
} from './dto/navigation-optimized.dto';

import {
  JourneyVisualizationRequestDto,
  JourneyVisualizationResponseDto,
  DriverTrackingDto,
  DriverTrackingResponseDto
} from './dto/journey-visualization.dto';

import { 
  GeocodingResult,
  Route,
  OptimizedRoute,
  DistanceMatrix,
  ETA,
  NavigationSession,
  NavigationUpdate,
  NavigationSummary,
  VoiceInstruction,
  UsageStats
} from './interfaces/mapbox.interface';

@ApiTags('Maps (Mapbox)')
@Controller('maps')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth()
export class MapsController {
  constructor(
    private readonly geocodingService: GeocodingService,
    private readonly routingService: RoutingService,
    private readonly matrixService: MatrixService,
    private readonly navigationService: NavigationService,
    private readonly optimizedNavigationService: OptimizedNavigationService,
    private readonly journeyVisualizationService: JourneyVisualizationService,
    private readonly mapboxService: MapboxService
  ) {}

  // ============================================================================
  // GEOCODING ENDPOINTS
  // ============================================================================

  @Post('geocoding/search')
  @ApiOperation({ summary: 'Search for places using geocoding' })
  @ApiResponse({ status: 200, description: 'Places found successfully', type: [Object] })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  @HttpCode(HttpStatus.OK)
  async searchPlaces(@Body() dto: GeocodeSearchDto): Promise<GeocodingResult[]> {
    return this.geocodingService.searchPlaces(dto.query, {
      proximity: dto.proximity,
      bbox: dto.bbox,
      country: dto.countries,
      types: dto.types,
      limit: dto.limit,
      autocomplete: dto.autocomplete,
      language: dto.language
    });
  }

  @Post('geocoding/reverse')
  @ApiOperation({ summary: 'Reverse geocode coordinates to address' })
  @ApiResponse({ status: 200, description: 'Address found successfully', type: Object })
  @ApiResponse({ status: 404, description: 'No address found for coordinates' })
  @HttpCode(HttpStatus.OK)
  async reverseGeocode(@Body() dto: ReverseGeocodeDto): Promise<GeocodingResult> {
    return this.geocodingService.reverseGeocode(dto.coordinates, dto.types);
  }

  @Post('geocoding/batch')
  @ApiOperation({ summary: 'Batch geocode multiple addresses' })
  @ApiResponse({ status: 200, description: 'Batch geocoding completed', type: [Object] })
  @ApiResponse({ status: 400, description: 'Invalid batch parameters' })
  @HttpCode(HttpStatus.OK)
  async batchGeocode(@Body() dto: BatchGeocodeDto): Promise<GeocodingResult[][]> {
    return this.geocodingService.batchGeocode(dto.queries, {
      proximity: dto.proximity,
      country: dto.countries,
      types: dto.types,
      language: dto.language
    });
  }

  @Get('geocoding/places/:placeId')
  @ApiOperation({ summary: 'Get place details by ID' })
  @ApiResponse({ status: 200, description: 'Place details retrieved', type: Object })
  @ApiResponse({ status: 404, description: 'Place not found' })
  async getPlaceDetails(@Param() params: PlaceDetailsDto): Promise<GeocodingResult> {
    return this.geocodingService.getPlaceDetails(params.placeId);
  }

  @Post('geocoding/nearby')
  @ApiOperation({ summary: 'Search for nearby places' })
  @ApiResponse({ status: 200, description: 'Nearby places found', type: [Object] })
  @ApiResponse({ status: 400, description: 'Invalid search parameters' })
  @HttpCode(HttpStatus.OK)
  async searchNearby(@Body() dto: SearchNearbyDto): Promise<GeocodingResult[]> {
    return this.geocodingService.searchNearby(
      dto.center,
      dto.radius,
      dto.query,
      dto.types
    );
  }

  @Post('geocoding/autocomplete')
  @ApiOperation({ summary: 'Get autocomplete suggestions' })
  @ApiResponse({ status: 200, description: 'Autocomplete suggestions', type: [Object] })
  @HttpCode(HttpStatus.OK)
  async autocomplete(@Body() dto: AutocompleteDto): Promise<GeocodingResult[]> {
    return this.geocodingService.autocomplete(dto.query, {
      proximity: dto.proximity,
      country: dto.countries,
      types: dto.types,
      limit: dto.limit
    });
  }

  // ============================================================================
  // ROUTING ENDPOINTS
  // ============================================================================

  @Post('routing/calculate')
  @ApiOperation({ summary: 'Calculate route between waypoints' })
  @ApiResponse({ status: 200, description: 'Route calculated successfully', type: Object })
  @ApiResponse({ status: 400, description: 'Invalid route parameters' })
  @ApiResponse({ status: 404, description: 'No route found' })
  @HttpCode(HttpStatus.OK)
  async calculateRoute(@Body() dto: CalculateRouteDto): Promise<Route> {
    return this.routingService.calculateRoute(dto.waypoints, {
      profile: dto.profile,
      alternatives: dto.alternatives,
      steps: dto.steps,
      geometries: dto.geometries,
      overview: dto.overview,
      continue_straight: dto.continue_straight,
      waypoint_names: dto.waypoint_names,
      annotations: dto.annotations,
      language: dto.language,
      roundtrip: dto.roundtrip,
      source: dto.source,
      destination: dto.destination,
      approaches: dto.approaches,
      radiuses: dto.radiuses,
      exclude: dto.exclude
    });
  }

  @Post('routing/alternatives')
  @ApiOperation({ summary: 'Get alternative routes between two points' })
  @ApiResponse({ status: 200, description: 'Alternative routes found', type: [Object] })
  @ApiResponse({ status: 404, description: 'No alternative routes found' })
  @HttpCode(HttpStatus.OK)
  async getAlternativeRoutes(@Body() dto: AlternativeRoutesDto): Promise<Route[]> {
    return this.routingService.getAlternativeRoutes(dto.origin, dto.destination, {
      profile: dto.profile
    });
  }

  @Post('routing/optimize')
  @ApiOperation({ summary: 'Optimize route order for multiple waypoints' })
  @ApiResponse({ status: 200, description: 'Route optimized successfully', type: Object })
  @ApiResponse({ status: 400, description: 'Invalid optimization parameters' })
  @HttpCode(HttpStatus.OK)
  async optimizeRoute(@Body() dto: OptimizeRouteDto): Promise<OptimizedRoute> {
    return this.routingService.optimizeRoute(dto.waypoints, {
      profile: dto.profile,
      roundtrip: dto.roundTrip,
      source: dto.source,
      destination: dto.destination,
      originalDistance: dto.originalDistance,
      originalDuration: dto.originalDuration
    });
  }

  @Post('routing/traffic')
  @ApiOperation({ summary: 'Get traffic-aware route' })
  @ApiResponse({ status: 200, description: 'Traffic route calculated', type: Object })
  @ApiResponse({ status: 404, description: 'No traffic route found' })
  @HttpCode(HttpStatus.OK)
  async getTrafficRoute(@Body() dto: TrafficRouteDto): Promise<Route> {
    const departureTime = dto.departureTime ? new Date(dto.departureTime) : undefined;
    return this.routingService.getTrafficRoute(dto.waypoints, departureTime);
  }

  @Post('routing/match')
  @ApiOperation({ summary: 'Match GPS trace to road network' })
  @ApiResponse({ status: 200, description: 'Route matched successfully', type: Object })
  @ApiResponse({ status: 400, description: 'Invalid GPS coordinates' })
  @HttpCode(HttpStatus.OK)
  async matchRoute(@Body() dto: RouteMatchDto): Promise<Route> {
    const timestamps = dto.timestamps?.map(ts => new Date(ts));
    return this.routingService.matchRoute(dto.coordinates, timestamps);
  }

  @Post('routing/eta')
  @ApiOperation({ summary: 'Get ETA between two points' })
  @ApiResponse({ status: 200, description: 'ETA calculated', type: Object })
  @HttpCode(HttpStatus.OK)
  async getRouteETA(@Body() dto: RouteEtaDto): Promise<{ duration: number; distance: number; eta: Date }> {
    return this.routingService.getRouteETA(dto.origin, dto.destination, dto.profile);
  }

  @Post('routing/batch-etas')
  @ApiOperation({ summary: 'Get ETAs for multiple origins to one destination' })
  @ApiResponse({ status: 200, description: 'Batch ETAs calculated', type: [Object] })
  @HttpCode(HttpStatus.OK)
  async getBatchRouteETAs(@Body() dto: BatchRoutesDto): Promise<Array<{ origin: [number, number]; eta: Date; distance: number; duration: number }>> {
    return this.routingService.estimateBatchRoutes(dto.origins, dto.destination, dto.profile);
  }

  // ============================================================================
  // MATRIX ENDPOINTS
  // ============================================================================

  @Post('matrix/distance')
  @ApiOperation({ summary: 'Calculate distance matrix' })
  @ApiResponse({ status: 200, description: 'Distance matrix calculated', type: Object })
  @ApiResponse({ status: 400, description: 'Invalid matrix parameters' })
  @HttpCode(HttpStatus.OK)
  async getDistanceMatrix(@Body() dto: DistanceMatrixDto): Promise<DistanceMatrix> {
    return this.matrixService.getDistanceMatrix(dto.origins, dto.destinations, {
      profile: dto.profile,
      annotations: dto.annotations,
      sources: dto.sources,
      destinations: dto.destinations_indices,
      fallback_speed: dto.fallback_speed
    });
  }

  @Post('matrix/etas')
  @ApiOperation({ summary: 'Calculate ETAs for journey participants' })
  @ApiResponse({ status: 200, description: 'ETAs calculated successfully' })
  @HttpCode(HttpStatus.OK)
  async getJourneyETAs(@Body() dto: JourneyEtaDto): Promise<Record<string, ETA>> {
    const participantLocations = new Map<string, [number, number]>();
    dto.participants.forEach(p => {
      participantLocations.set(p.participantId, p.location);
    });

    const etas = await this.matrixService.getETAs(participantLocations, dto.destination);
    
    // Convert Map to object for JSON response
    const result: Record<string, ETA> = {};
    etas.forEach((eta, participantId) => {
      result[participantId] = eta;
    });
    
    return result;
  }

  @Post('matrix/batch-etas')
  @ApiOperation({ summary: 'Calculate ETAs for multiple journey groups' })
  @ApiResponse({ status: 200, description: 'Batch ETAs calculated' })
  @HttpCode(HttpStatus.OK)
  async getBatchETAs(@Body() dto: BatchEtaDto): Promise<Record<string, Record<string, ETA>>> {
    const participantGroups = dto.journeyGroups.map(group => ({
      groupId: group.groupId,
      participants: new Map(group.participants.map(p => [p.participantId, p.location])),
      destination: group.destination
    }));

    const etas = await this.matrixService.getBatchETAs(participantGroups);
    
    // Convert nested Maps to nested objects for JSON response
    const result: Record<string, Record<string, ETA>> = {};
    etas.forEach((groupETAs, groupId) => {
      result[groupId] = {};
      groupETAs.forEach((eta, participantId) => {
        result[groupId][participantId] = eta;
      });
    });
    
    return result;
  }

  @Post('matrix/distance-between')
  @ApiOperation({ summary: 'Get distance and duration between two points' })
  @ApiResponse({ status: 200, description: 'Distance calculated' })
  @HttpCode(HttpStatus.OK)
  async getDistanceBetween(@Body() dto: DistanceBetweenDto): Promise<{ distance: number; duration: number }> {
    return this.matrixService.getDistanceBetweenPoints(dto.origin, dto.destination, dto.profile);
  }

  @Post('matrix/nearest')
  @ApiOperation({ summary: 'Find nearest point from candidates' })
  @ApiResponse({ status: 200, description: 'Nearest point found' })
  @HttpCode(HttpStatus.OK)
  async findNearestPoint(@Body() dto: FindNearestDto): Promise<{ index: number; distance: number; duration: number; coordinates: [number, number] }> {
    return this.matrixService.findNearestPoint(dto.target, dto.candidates, dto.profile);
  }

  @Post('matrix/lag-distance')
  @ApiOperation({ summary: 'Calculate lag distance between current and expected position' })
  @ApiResponse({ status: 200, description: 'Lag distance calculated' })
  @HttpCode(HttpStatus.OK)
  async calculateLagDistance(@Body() dto: LagDistanceDto): Promise<{ lagDistance: number }> {
    const distance = await this.matrixService.calculateLagDistance(
      dto.currentPosition, 
      dto.expectedPosition, 
      dto.profile
    );
    return { lagDistance: distance };
  }

  @Post('matrix/radius-check')
  @ApiOperation({ summary: 'Check if point is within radius' })
  @ApiResponse({ status: 200, description: 'Radius check completed' })
  @HttpCode(HttpStatus.OK)
  async checkWithinRadius(@Body() dto: RadiusCheckDto): Promise<{ withinRadius: boolean; distance: number }> {
    const distance = await this.matrixService.getDistanceBetweenPoints(dto.center, dto.point, dto.profile);
    return {
      withinRadius: distance.distance <= dto.radiusMeters,
      distance: distance.distance
    };
  }

  @Post('matrix/rank-proximity')
  @ApiOperation({ summary: 'Rank points by proximity to target' })
  @ApiResponse({ status: 200, description: 'Points ranked by proximity' })
  @HttpCode(HttpStatus.OK)
  async rankByProximity(@Body() dto: RankByProximityDto): Promise<Array<{ id: string; coordinates: [number, number]; distance: number; duration: number; rank: number }>> {
    return this.matrixService.rankByProximity(dto.target, dto.points, dto.profile);
  }

  // ============================================================================
  // NAVIGATION ENDPOINTS
  // ============================================================================

  @Post('navigation/start')
  @ApiOperation({ summary: 'Start a new navigation session' })
  @ApiResponse({ status: 201, description: 'Navigation started', type: NavigationSessionResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid navigation parameters' })
  async startNavigation(@Body() dto: StartNavigationDto): Promise<NavigationSession> {
    return this.navigationService.startNavigation(dto.origin, dto.destination, {
      profile: dto.profile,
      voice: dto.voice,
      banner: dto.banner,
      language: dto.language,
      units: dto.units
    });
  }

  @Put('navigation/:sessionId/update')
  @ApiOperation({ summary: 'Update navigation progress' })
  @ApiResponse({ status: 200, description: 'Navigation updated', type: NavigationUpdateResponseDto })
  @ApiResponse({ status: 404, description: 'Navigation session not found' })
  async updateNavigation(
    @Param() params: NavigationSessionParamsDto,
    @Body() dto: UpdateNavigationDto
  ): Promise<NavigationUpdate> {
    return this.navigationService.updateNavigationProgress(
      params.sessionId,
      dto.currentLocation,
      dto.heading
    );
  }

  @Put('navigation/:sessionId/pause')
  @ApiOperation({ summary: 'Pause navigation session' })
  @ApiResponse({ status: 200, description: 'Navigation paused', type: NavigationSessionResponseDto })
  @ApiResponse({ status: 404, description: 'Navigation session not found' })
  async pauseNavigation(@Param() params: NavigationControlDto): Promise<NavigationSession> {
    return this.navigationService.pauseNavigation(params.sessionId);
  }

  @Put('navigation/:sessionId/resume')
  @ApiOperation({ summary: 'Resume navigation session' })
  @ApiResponse({ status: 200, description: 'Navigation resumed', type: NavigationSessionResponseDto })
  @ApiResponse({ status: 404, description: 'Navigation session not found' })
  async resumeNavigation(@Param() params: NavigationControlDto): Promise<NavigationSession> {
    return this.navigationService.resumeNavigation(params.sessionId);
  }

  @Delete('navigation/:sessionId')
  @ApiOperation({ summary: 'End navigation session' })
  @ApiResponse({ status: 200, description: 'Navigation ended', type: NavigationSummaryResponseDto })
  @ApiResponse({ status: 404, description: 'Navigation session not found' })
  async endNavigation(@Param() params: NavigationControlDto): Promise<NavigationSummary> {
    return this.navigationService.endNavigation(params.sessionId);
  }

  @Delete('navigation/:sessionId/cancel')
  @ApiOperation({ summary: 'Cancel navigation session' })
  @ApiResponse({ status: 200, description: 'Navigation cancelled', type: NavigationSummaryResponseDto })
  @ApiResponse({ status: 404, description: 'Navigation session not found' })
  async cancelNavigation(@Param() params: NavigationControlDto): Promise<NavigationSummary> {
    return this.navigationService.cancelNavigation(params.sessionId);
  }

  @Post('navigation/voice-instructions')
  @ApiOperation({ summary: 'Get voice instructions for current location' })
  @ApiResponse({ status: 200, description: 'Voice instructions retrieved', type: [VoiceInstructionResponseDto] })
  @HttpCode(HttpStatus.OK)
  async getVoiceInstructions(@Body() dto: VoiceInstructionsDto): Promise<VoiceInstruction[]> {
    return this.navigationService.getVoiceInstructions(dto.sessionId, dto.distanceToManeuver);
  }

  @Get('navigation/active')
  @ApiOperation({ summary: 'Get active navigation sessions' })
  @ApiResponse({ status: 200, description: 'Active sessions retrieved', type: [NavigationSessionResponseDto] })
  async getActiveNavigationSessions(): Promise<NavigationSession[]> {
    return this.navigationService.getActiveNavigationSessions();
  }

  @Get('navigation/statistics')
  @ApiOperation({ summary: 'Get navigation statistics' })
  @ApiResponse({ status: 200, description: 'Navigation statistics', type: NavigationStatsResponseDto })
  async getNavigationStatistics(): Promise<{
    activeSessions: number;
    completedSessions: number;
    averageDuration: number;
    totalDistance: number;
  }> {
    return this.navigationService.getNavigationStatistics();
  }

  // ============================================================================
  // UTILITY ENDPOINTS
  // ============================================================================

  @Get('usage/statistics')
  @ApiOperation({ summary: 'Get Mapbox API usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved' })
  async getUsageStatistics(): Promise<UsageStats> {
    return this.mapboxService.getUsageStats();
  }

  @Get('health')
  @ApiOperation({ summary: 'Check Maps service health' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    // Basic health check - in production, you'd check Mapbox API connectivity
    return {
      status: 'healthy',
      timestamp: new Date().toISOString()
    };
  }

  @Post('validate/coordinates')
  @ApiOperation({ summary: 'Validate coordinate pairs' })
  @ApiResponse({ status: 200, description: 'Coordinates validation result' })
  @HttpCode(HttpStatus.OK)
  async validateCoordinates(
    @Body() body: { coordinates: [number, number][] }
  ): Promise<{ valid: boolean; invalidIndices: number[] }> {
    const invalidIndices: number[] = [];
    
    body.coordinates.forEach((coords, index) => {
      if (!this.geocodingService.validateCoordinates(coords)) {
        invalidIndices.push(index);
      }
    });
    
    return {
      valid: invalidIndices.length === 0,
      invalidIndices
    };
  }

  // ============================================================================
  // OPTIMIZED NAVIGATION ENDPOINTS (for real-time driving)
  // ============================================================================

  @Post('navigation-optimized/start')
  @ApiOperation({ summary: 'Start optimized navigation with chunked data loading' })
  @ApiResponse({ status: 201, description: 'Optimized navigation started with initial chunk' })
  @ApiResponse({ status: 400, description: 'Invalid navigation parameters' })
  async startOptimizedNavigation(
    @Body() body: { origin: [number, number]; destination: [number, number]; options?: any }
  ): Promise<{ sessionId: string; initialChunk: NavigationChunkResponseDto }> {
    return this.optimizedNavigationService.startOptimizedNavigation(
      body.origin,
      body.destination,
      body.options || {}
    );
  }

  @Post('navigation-optimized/:sessionId/update')
  @ApiOperation({ summary: 'Update optimized navigation with minimal data transfer' })
  @ApiResponse({ status: 200, description: 'Navigation updated with progress and next chunk' })
  @ApiResponse({ status: 404, description: 'Navigation session not found' })
  @HttpCode(HttpStatus.OK)
  async updateOptimizedNavigation(
    @Param('sessionId') sessionId: string,
    @Body() update: NavigationUpdateOptimizedDto
  ): Promise<ProgressiveNavigationResponseDto> {
    return this.optimizedNavigationService.updateOptimizedNavigation(sessionId, update);
  }

  @Post('navigation-optimized/:sessionId/chunk')
  @ApiOperation({ summary: 'Get next route chunk for optimized navigation' })
  @ApiResponse({ status: 200, description: 'Route chunk retrieved' })
  @ApiResponse({ status: 404, description: 'Navigation session not found' })
  @HttpCode(HttpStatus.OK)
  async getNavigationChunk(
    @Param('sessionId') sessionId: string,
    @Body() request: NavigationChunkRequestDto
  ): Promise<NavigationChunkResponseDto> {
    return this.optimizedNavigationService.getRouteChunk(
      sessionId,
      request.currentIndex,
      request.lookAhead || 50,
      request.includeVoice || false
    );
  }

  @Delete('navigation-optimized/:sessionId')
  @ApiOperation({ summary: 'End optimized navigation session' })
  @ApiResponse({ status: 200, description: 'Optimized navigation ended' })
  @ApiResponse({ status: 404, description: 'Navigation session not found' })
  async endOptimizedNavigation(@Param('sessionId') sessionId: string): Promise<{ message: string }> {
    await this.optimizedNavigationService.endOptimizedNavigation(sessionId);
    return { message: 'Navigation session ended successfully' };
  }

  // ============================================================================
  // JOURNEY VISUALIZATION ENDPOINTS (for multi-driver maps)
  // ============================================================================

  @Post('journey-visualization')
  @ApiOperation({ summary: 'Get real-time visualization of all drivers in a journey' })
  @ApiResponse({ status: 200, description: 'Journey visualization data with driver locations and profiles' })
  @ApiResponse({ status: 403, description: 'Not authorized to access this journey' })
  @ApiResponse({ status: 404, description: 'Journey not found' })
  @HttpCode(HttpStatus.OK)
  async getJourneyVisualization(
    @CurrentUser('uid') userId: string,
    @Body() request: JourneyVisualizationRequestDto
  ): Promise<JourneyVisualizationResponseDto> {
    return this.journeyVisualizationService.getJourneyVisualization(userId, request);
  }

  @Post('driver-tracking')
  @ApiOperation({ summary: 'Track specific driver with location history and route' })
  @ApiResponse({ status: 200, description: 'Driver tracking data with profile and navigation info' })
  @ApiResponse({ status: 403, description: 'Not authorized to access this journey' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  @HttpCode(HttpStatus.OK)
  async trackDriver(
    @CurrentUser('uid') userId: string,
    @Body() request: DriverTrackingDto
  ): Promise<DriverTrackingResponseDto> {
    return this.journeyVisualizationService.trackSpecificDriver(userId, request);
  }
}