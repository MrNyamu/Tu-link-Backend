import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

enum MatrixProfile {
  DRIVING = 'driving',
  WALKING = 'walking',
  CYCLING = 'cycling',
  DRIVING_TRAFFIC = 'driving-traffic'
}

export class DistanceMatrixDto {
  @ApiProperty({
    description: 'Array of origin coordinates [lng, lat]',
    example: [[-74.006, 40.7128], [-74.010, 40.7140]],
    type: 'array',
    items: {
      type: 'array',
      items: {
        type: 'number'
      }
    }
  })
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error('Origins cannot be empty');
    }
    if (value.length > 20) {
      throw new Error('Maximum 20 origins allowed');
    }
    return value.map((coords, index) => {
      if (!Array.isArray(coords) || coords.length !== 2) {
        throw new Error(`Invalid origin coordinates at index ${index}`);
      }
      const [lng, lat] = coords;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error(`Invalid coordinates at origin ${index}: [${lng}, ${lat}]`);
      }
      return coords;
    });
  })
  origins: [number, number][];

  @ApiProperty({
    description: 'Array of destination coordinates [lng, lat]',
    example: [[-73.985, 40.758], [-73.980, 40.760]],
    type: 'array',
    items: {
      type: 'array',
      items: {
        type: 'number'
      }
    }
  })
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error('Destinations cannot be empty');
    }
    if (value.length > 20) {
      throw new Error('Maximum 20 destinations allowed');
    }
    return value.map((coords, index) => {
      if (!Array.isArray(coords) || coords.length !== 2) {
        throw new Error(`Invalid destination coordinates at index ${index}`);
      }
      const [lng, lat] = coords;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error(`Invalid coordinates at destination ${index}: [${lng}, ${lat}]`);
      }
      return coords;
    });
  })
  destinations: [number, number][];

  @ApiPropertyOptional({
    description: 'Routing profile for matrix calculation',
    enum: MatrixProfile,
    example: MatrixProfile.DRIVING_TRAFFIC
  })
  @IsOptional()
  @IsEnum(MatrixProfile)
  profile?: MatrixProfile;

  @ApiPropertyOptional({
    description: 'Annotations to include in response',
    example: ['distance', 'duration'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  annotations?: string[];

  @ApiPropertyOptional({
    description: 'Specific source indices to use',
    example: [0, 1],
    type: [Number]
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  sources?: number[];

  @ApiPropertyOptional({
    description: 'Specific destination indices to use',
    example: [0, 1],
    type: [Number]
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  destinations_indices?: number[];

  @ApiPropertyOptional({
    description: 'Fallback speed for unreachable coordinates (km/h)',
    example: 25,
    minimum: 1,
    maximum: 300
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(300)
  fallback_speed?: number;
}

export class ParticipantLocationDto {
  @ApiProperty({
    description: 'Participant ID',
    example: 'participant_123'
  })
  participantId: string;

  @ApiProperty({
    description: 'Current location [lng, lat]',
    example: [-74.006, 40.7128],
    type: [Number]
  })
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error('Location must be [lng, lat] coordinates');
    }
    const [lng, lat] = value;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Invalid location coordinates');
    }
    return value;
  })
  location: [number, number];
}

export class JourneyEtaDto {
  @ApiProperty({
    description: 'Journey ID',
    example: 'journey_456'
  })
  journeyId: string;

  @ApiProperty({
    description: 'Array of participant locations',
    type: [ParticipantLocationDto]
  })
  @IsArray()
  participants: ParticipantLocationDto[];

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
    description: 'Routing profile',
    enum: MatrixProfile,
    example: MatrixProfile.DRIVING_TRAFFIC
  })
  @IsOptional()
  @IsEnum(MatrixProfile)
  profile?: MatrixProfile;
}

export class BatchEtaDto {
  @ApiProperty({
    description: 'Array of journey groups',
    type: [Object]
  })
  @IsArray()
  journeyGroups: Array<{
    groupId: string;
    participants: Array<{
      participantId: string;
      location: [number, number];
    }>;
    destination: [number, number];
  }>;

  @ApiPropertyOptional({
    description: 'Routing profile',
    enum: MatrixProfile,
    example: MatrixProfile.DRIVING_TRAFFIC
  })
  @IsOptional()
  @IsEnum(MatrixProfile)
  profile?: MatrixProfile;
}

export class DistanceBetweenDto {
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
    description: 'Routing profile',
    enum: MatrixProfile,
    example: MatrixProfile.DRIVING_TRAFFIC
  })
  @IsOptional()
  @IsEnum(MatrixProfile)
  profile?: MatrixProfile;
}

export class FindNearestDto {
  @ApiProperty({
    description: 'Target coordinates [lng, lat]',
    example: [-74.006, 40.7128],
    type: [Number]
  })
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error('Target must be [lng, lat] coordinates');
    }
    const [lng, lat] = value;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Invalid target coordinates');
    }
    return value;
  })
  target: [number, number];

  @ApiProperty({
    description: 'Array of candidate coordinates [lng, lat]',
    example: [[-74.010, 40.7140], [-73.985, 40.758]],
    type: 'array',
    items: {
      type: 'array',
      items: {
        type: 'number'
      }
    }
  })
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error('Candidates cannot be empty');
    }
    if (value.length > 50) {
      throw new Error('Maximum 50 candidates allowed');
    }
    return value.map((coords, index) => {
      if (!Array.isArray(coords) || coords.length !== 2) {
        throw new Error(`Invalid candidate coordinates at index ${index}`);
      }
      const [lng, lat] = coords;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error(`Invalid coordinates at candidate ${index}`);
      }
      return coords;
    });
  })
  candidates: [number, number][];

  @ApiPropertyOptional({
    description: 'Routing profile',
    enum: MatrixProfile,
    example: MatrixProfile.DRIVING_TRAFFIC
  })
  @IsOptional()
  @IsEnum(MatrixProfile)
  profile?: MatrixProfile;
}

export class LagDistanceDto {
  @ApiProperty({
    description: 'Current position [lng, lat]',
    example: [-74.006, 40.7128],
    type: [Number]
  })
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error('Current position must be [lng, lat] coordinates');
    }
    const [lng, lat] = value;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Invalid current position coordinates');
    }
    return value;
  })
  currentPosition: [number, number];

  @ApiProperty({
    description: 'Expected position [lng, lat]',
    example: [-74.005, 40.7130],
    type: [Number]
  })
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error('Expected position must be [lng, lat] coordinates');
    }
    const [lng, lat] = value;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Invalid expected position coordinates');
    }
    return value;
  })
  expectedPosition: [number, number];

  @ApiPropertyOptional({
    description: 'Routing profile',
    enum: MatrixProfile,
    example: MatrixProfile.DRIVING_TRAFFIC
  })
  @IsOptional()
  @IsEnum(MatrixProfile)
  profile?: MatrixProfile;
}

export class RadiusCheckDto {
  @ApiProperty({
    description: 'Center coordinates [lng, lat]',
    example: [-74.006, 40.7128],
    type: [Number]
  })
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error('Center must be [lng, lat] coordinates');
    }
    const [lng, lat] = value;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Invalid center coordinates');
    }
    return value;
  })
  center: [number, number];

  @ApiProperty({
    description: 'Point to check [lng, lat]',
    example: [-74.005, 40.7130],
    type: [Number]
  })
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error('Point must be [lng, lat] coordinates');
    }
    const [lng, lat] = value;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Invalid point coordinates');
    }
    return value;
  })
  point: [number, number];

  @ApiProperty({
    description: 'Radius in meters',
    example: 1000,
    minimum: 1,
    maximum: 50000
  })
  @IsNumber()
  @Min(1)
  @Max(50000)
  radiusMeters: number;

  @ApiPropertyOptional({
    description: 'Routing profile',
    enum: MatrixProfile,
    example: MatrixProfile.DRIVING_TRAFFIC
  })
  @IsOptional()
  @IsEnum(MatrixProfile)
  profile?: MatrixProfile;
}

export class RankByProximityDto {
  @ApiProperty({
    description: 'Target coordinates [lng, lat]',
    example: [-74.006, 40.7128],
    type: [Number]
  })
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new Error('Target must be [lng, lat] coordinates');
    }
    const [lng, lat] = value;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error('Invalid target coordinates');
    }
    return value;
  })
  target: [number, number];

  @ApiProperty({
    description: 'Points to rank with IDs',
    example: [
      { id: 'point1', coordinates: [-74.010, 40.7140] },
      { id: 'point2', coordinates: [-73.985, 40.758] }
    ],
    type: [Object]
  })
  @IsArray()
  @Transform(({ value }) => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error('Points cannot be empty');
    }
    if (value.length > 50) {
      throw new Error('Maximum 50 points allowed');
    }
    return value.map((point, index) => {
      if (!point.id || !point.coordinates) {
        throw new Error(`Point at index ${index} must have id and coordinates`);
      }
      if (!Array.isArray(point.coordinates) || point.coordinates.length !== 2) {
        throw new Error(`Invalid coordinates format at point ${index}`);
      }
      const [lng, lat] = point.coordinates;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error(`Invalid coordinates at point ${index}`);
      }
      return point;
    });
  })
  points: Array<{ id: string; coordinates: [number, number] }>;

  @ApiPropertyOptional({
    description: 'Routing profile',
    enum: MatrixProfile,
    example: MatrixProfile.DRIVING_TRAFFIC
  })
  @IsOptional()
  @IsEnum(MatrixProfile)
  profile?: MatrixProfile;
}