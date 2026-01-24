import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsBoolean, IsEnum, IsNumber, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

enum NavigationProfile {
  DRIVING = 'driving',
  WALKING = 'walking',
  CYCLING = 'cycling',
  DRIVING_TRAFFIC = 'driving-traffic'
}

enum UnitsType {
  METRIC = 'metric',
  IMPERIAL = 'imperial'
}

export class StartNavigationDto {
  @ApiProperty({
    description: 'Origin coordinates [lng, lat]',
    example: [-74.006, 40.7128],
    type: [Number]
  })
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error('Origin must be [lng, lat] coordinates');
    }
    const [lng, lat] = value;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Invalid origin coordinates');
    }
    return value;
  })
  origin: [number, number];

  @ApiProperty({
    description: 'Destination coordinates [lng, lat]',
    example: [-73.985, 40.758],
    type: [Number]
  })
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error('Destination must be [lng, lat] coordinates');
    }
    const [lng, lat] = value;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Invalid destination coordinates');
    }
    return value;
  })
  destination: [number, number];

  @ApiPropertyOptional({
    description: 'Navigation profile',
    enum: NavigationProfile,
    example: NavigationProfile.DRIVING_TRAFFIC
  })
  @IsOptional()
  @IsEnum(NavigationProfile)
  profile?: NavigationProfile;

  @ApiPropertyOptional({
    description: 'Enable voice instructions',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  voice?: boolean;

  @ApiPropertyOptional({
    description: 'Enable banner instructions',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  banner?: boolean;

  @ApiPropertyOptional({
    description: 'Language for instructions (ISO 639-1)',
    example: 'en'
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'Units for measurements',
    enum: UnitsType,
    example: UnitsType.METRIC
  })
  @IsOptional()
  @IsEnum(UnitsType)
  units?: UnitsType;
}

export class UpdateNavigationDto {
  @ApiProperty({
    description: 'Current location [lng, lat]',
    example: [-74.005, 40.7130],
    type: [Number]
  })
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error('Current location must be [lng, lat] coordinates');
    }
    const [lng, lat] = value;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Invalid current location coordinates');
    }
    return value;
  })
  currentLocation: [number, number];

  @ApiPropertyOptional({
    description: 'Current heading in degrees (0-360)',
    example: 45,
    minimum: 0,
    maximum: 360
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => {
    if (value !== undefined && (value < 0 || value > 360)) {
      throw new Error('Heading must be between 0 and 360 degrees');
    }
    return value;
  })
  heading?: number;
}

export class VoiceInstructionsDto {
  @ApiProperty({
    description: 'Navigation session ID',
    example: 'nav_123e4567-e89b-12d3-a456-426614174000'
  })
  @IsString()
  @IsUUID()
  sessionId: string;

  @ApiProperty({
    description: 'Distance to next maneuver in meters',
    example: 150,
    minimum: 0
  })
  @IsNumber()
  @Transform(({ value }) => {
    if (value < 0) {
      throw new Error('Distance to maneuver cannot be negative');
    }
    return value;
  })
  distanceToManeuver: number;
}

export class NavigationSessionParamsDto {
  @ApiProperty({
    description: 'Navigation session ID',
    example: 'nav_123e4567-e89b-12d3-a456-426614174000'
  })
  @IsString()
  @IsUUID()
  sessionId: string;
}

export class NavigationControlDto {
  @ApiProperty({
    description: 'Navigation session ID',
    example: 'nav_123e4567-e89b-12d3-a456-426614174000'
  })
  @IsString()
  @IsUUID()
  sessionId: string;
}

// Response DTOs (for documentation purposes)
export class NavigationSessionResponseDto {
  @ApiProperty({
    description: 'Unique session identifier',
    example: 'nav_123e4567-e89b-12d3-a456-426614174000'
  })
  id: string;

  @ApiProperty({
    description: 'Route information'
  })
  route: {
    id: string;
    distance: number;
    duration: number;
    geometry: any;
    legs: any[];
    waypoints: any[];
  };

  @ApiProperty({
    description: 'Session start time',
    example: '2024-01-15T10:00:00Z'
  })
  startTime: string;

  @ApiProperty({
    description: 'Current step index',
    example: 0
  })
  currentStep: number;

  @ApiProperty({
    description: 'Session status',
    example: 'active',
    enum: ['active', 'paused', 'completed', 'cancelled']
  })
  status: string;

  @ApiProperty({
    description: 'Navigation options'
  })
  options: {
    profile?: string;
    voice?: boolean;
    banner?: boolean;
    language?: string;
    units?: string;
  };
}

export class NavigationUpdateResponseDto {
  @ApiProperty({
    description: 'Session ID',
    example: 'nav_123e4567-e89b-12d3-a456-426614174000'
  })
  sessionId: string;

  @ApiProperty({
    description: 'Current location [lng, lat]',
    example: [-74.005, 40.7130],
    type: [Number]
  })
  currentLocation: [number, number];

  @ApiProperty({
    description: 'Current heading in degrees',
    example: 45
  })
  heading?: number;

  @ApiProperty({
    description: 'Route progress information'
  })
  progress: {
    currentStep: number;
    distanceRemaining: number;
    durationRemaining: number;
    distanceTraveled: number;
    fractionTraveled: number;
    remainingSteps: any[];
  };

  @ApiProperty({
    description: 'Next navigation instruction'
  })
  nextInstruction?: {
    distance: number;
    instruction: string;
    type: string;
    modifier?: string;
  };

  @ApiProperty({
    description: 'Route deviation information'
  })
  deviation?: {
    distance: number;
    shouldReroute: boolean;
    confidence: number;
  };

  @ApiProperty({
    description: 'Estimated arrival time',
    example: '2024-01-15T10:30:00Z'
  })
  estimatedArrival: string;

  @ApiProperty({
    description: 'Whether route was recalculated',
    example: false
  })
  rerouted: boolean;
}

export class NavigationSummaryResponseDto {
  @ApiProperty({
    description: 'Session ID',
    example: 'nav_123e4567-e89b-12d3-a456-426614174000'
  })
  sessionId: string;

  @ApiProperty({
    description: 'Navigation start time',
    example: '2024-01-15T10:00:00Z'
  })
  startTime: string;

  @ApiProperty({
    description: 'Navigation end time',
    example: '2024-01-15T10:25:00Z'
  })
  endTime: string;

  @ApiProperty({
    description: 'Planned duration in seconds',
    example: 1800
  })
  plannedDuration: number;

  @ApiProperty({
    description: 'Actual duration in seconds',
    example: 1500
  })
  actualDuration: number;

  @ApiProperty({
    description: 'Planned distance in meters',
    example: 15000
  })
  plannedDistance: number;

  @ApiProperty({
    description: 'Actual distance in meters',
    example: 15000
  })
  actualDistance: number;

  @ApiProperty({
    description: 'Whether navigation was completed successfully',
    example: true
  })
  completed: boolean;
}

export class VoiceInstructionResponseDto {
  @ApiProperty({
    description: 'Distance along geometry where instruction should be announced',
    example: 150
  })
  distanceAlongGeometry: number;

  @ApiProperty({
    description: 'Voice announcement text',
    example: 'In 150 meters, turn right onto Broadway'
  })
  announcement: string;

  @ApiProperty({
    description: 'SSML formatted announcement'
  })
  ssmlAnnouncement?: string;
}

export class NavigationStatsResponseDto {
  @ApiProperty({
    description: 'Number of active navigation sessions',
    example: 5
  })
  activeSessions: number;

  @ApiProperty({
    description: 'Number of completed navigation sessions',
    example: 150
  })
  completedSessions: number;

  @ApiProperty({
    description: 'Average navigation duration in seconds',
    example: 1200
  })
  averageDuration: number;

  @ApiProperty({
    description: 'Total distance navigated in meters',
    example: 500000
  })
  totalDistance: number;
}