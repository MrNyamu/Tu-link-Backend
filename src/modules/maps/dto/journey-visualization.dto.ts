import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsNumber, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum DriverStatus {
  ACTIVE = 'ACTIVE',
  NAVIGATING = 'NAVIGATING', 
  PAUSED = 'PAUSED',
  OFFLINE = 'OFFLINE',
  ARRIVED = 'ARRIVED'
}

export class DriverLocationDto {
  @ApiProperty({
    description: 'Participant/Driver ID',
    example: 'participant-123'
  })
  @IsString()
  participantId: string;

  @ApiProperty({
    description: 'Driver user ID',
    example: 'user-456'
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Driver display name',
    example: 'John Doe'
  })
  @IsString()
  displayName: string;

  @ApiPropertyOptional({
    description: 'Driver profile photo URL',
    example: 'https://example.com/photos/user123.jpg'
  })
  @IsOptional()
  @IsString()
  photoURL?: string;

  @ApiProperty({
    description: 'Current location [lng, lat]',
    example: [-74.006, 40.7128],
    type: [Number]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  location: [number, number];

  @ApiProperty({
    description: 'Current heading in degrees',
    example: 45,
    minimum: 0,
    maximum: 360
  })
  @IsNumber()
  heading: number;

  @ApiProperty({
    description: 'Current speed in m/s',
    example: 13.89
  })
  @IsNumber()
  speed: number;

  @ApiProperty({
    description: 'Driver status',
    enum: DriverStatus,
    example: DriverStatus.NAVIGATING
  })
  @IsEnum(DriverStatus)
  status: DriverStatus;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-24T10:30:00Z'
  })
  @IsDateString()
  lastUpdate: string;

  @ApiPropertyOptional({
    description: 'Estimated time to destination (seconds)',
    example: 1800
  })
  @IsOptional()
  @IsNumber()
  etaSeconds?: number;

  @ApiPropertyOptional({
    description: 'Distance to destination (meters)',
    example: 15000
  })
  @IsOptional()
  @IsNumber()
  distanceToDestination?: number;

  @ApiProperty({
    description: 'Participant role',
    example: 'FOLLOWER'
  })
  @IsString()
  role: 'LEADER' | 'FOLLOWER';

  @ApiPropertyOptional({
    description: 'Whether this driver is lagging behind',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  isLagging?: boolean;

  @ApiPropertyOptional({
    description: 'Battery level (0-100)',
    example: 85
  })
  @IsOptional()
  @IsNumber()
  batteryLevel?: number;
}

export class JourneyVisualizationRequestDto {
  @ApiProperty({
    description: 'Journey ID',
    example: 'journey-123'
  })
  @IsString()
  journeyId: string;

  @ApiPropertyOptional({
    description: 'Include route geometry for visualization',
    example: true,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  includeRoute?: boolean;

  @ApiPropertyOptional({
    description: 'Include ETA calculations',
    example: true,
    default: true
  })
  @IsOptional()
  @IsBoolean()
  includeETA?: boolean;

  @ApiPropertyOptional({
    description: 'Viewport bounds for filtering [minLng, minLat, maxLng, maxLat]',
    example: [-74.1, 40.6, -73.9, 40.8],
    type: [Number]
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  viewport?: [number, number, number, number];
}

export class JourneyVisualizationResponseDto {
  @ApiProperty({
    description: 'Journey information'
  })
  journey: {
    id: string;
    name: string;
    status: string;
    destination: {
      coordinates: [number, number];
      address: string;
    };
  };

  @ApiProperty({
    description: 'All active drivers in the journey',
    type: [DriverLocationDto]
  })
  drivers: DriverLocationDto[];

  @ApiPropertyOptional({
    description: 'Journey route geometry (if requested)',
    type: Object
  })
  route?: {
    geometry: any;
    distance: number;
    duration: number;
  };

  @ApiProperty({
    description: 'Response metadata'
  })
  metadata: {
    totalDrivers: number;
    activeDrivers: number;
    lastUpdate: string;
    refreshIntervalSeconds: number;
  };
}

export class DriverTrackingDto {
  @ApiProperty({
    description: 'Journey ID',
    example: 'journey-123'
  })
  @IsString()
  journeyId: string;

  @ApiProperty({
    description: 'Participant ID to track',
    example: 'participant-456'
  })
  @IsString()
  participantId: string;

  @ApiPropertyOptional({
    description: 'Number of recent locations to include',
    example: 10,
    default: 5
  })
  @IsOptional()
  @IsNumber()
  historyCount?: number;
}

export class DriverTrackingResponseDto {
  @ApiProperty({
    description: 'Driver information',
    type: DriverLocationDto
  })
  driver: DriverLocationDto;

  @ApiProperty({
    description: 'Recent location history',
    type: [Object]
  })
  locationHistory: Array<{
    location: [number, number];
    timestamp: string;
    speed: number;
    heading: number;
  }>;

  @ApiProperty({
    description: 'Route to destination (if driver is navigating)'
  })
  routeToDestination?: {
    geometry: any;
    distance: number;
    duration: number;
    instructions: string[];
  };
}