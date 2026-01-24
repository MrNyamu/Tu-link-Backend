import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, IsEnum, IsDateString, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

enum RouteProfile {
  DRIVING = 'driving',
  WALKING = 'walking',
  CYCLING = 'cycling',
  DRIVING_TRAFFIC = 'driving-traffic'
}

enum GeometryFormat {
  GEOJSON = 'geojson',
  POLYLINE = 'polyline',
  POLYLINE6 = 'polyline6'
}

enum OverviewLevel {
  FULL = 'full',
  SIMPLIFIED = 'simplified',
  FALSE = 'false'
}

export class CalculateRouteDto {
  @ApiProperty({
    description: 'Array of waypoints as [lng, lat] coordinates',
    example: [[-74.006, 40.7128], [-73.985, 40.758]],
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
    if (!Array.isArray(value) || value.length < 2) {
      throw new Error('At least 2 waypoints are required');
    }
    if (value.length > 25) {
      throw new Error('Maximum 25 waypoints allowed');
    }
    return value.map((coords, index) => {
      if (!Array.isArray(coords) || coords.length !== 2) {
        throw new Error(`Invalid coordinates format at waypoint ${index}`);
      }
      const [lng, lat] = coords;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error(`Invalid coordinates at waypoint ${index}: [${lng}, ${lat}]`);
      }
      return coords;
    });
  })
  waypoints: [number, number][];

  @ApiPropertyOptional({
    description: 'Routing profile',
    enum: RouteProfile,
    example: RouteProfile.DRIVING_TRAFFIC
  })
  @IsOptional()
  @IsEnum(RouteProfile)
  profile?: RouteProfile;

  @ApiPropertyOptional({
    description: 'Return alternative routes',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  alternatives?: boolean;

  @ApiPropertyOptional({
    description: 'Include turn-by-turn steps',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  steps?: boolean;

  @ApiPropertyOptional({
    description: 'Geometry format for response',
    enum: GeometryFormat,
    example: GeometryFormat.GEOJSON
  })
  @IsOptional()
  @IsEnum(GeometryFormat)
  geometries?: GeometryFormat;

  @ApiPropertyOptional({
    description: 'Level of detail in route geometry',
    enum: OverviewLevel,
    example: OverviewLevel.FULL
  })
  @IsOptional()
  @IsEnum(OverviewLevel)
  overview?: OverviewLevel;

  @ApiPropertyOptional({
    description: 'Force route to go straight at waypoints',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  continue_straight?: boolean;

  @ApiPropertyOptional({
    description: 'Names for waypoints',
    example: ['Start', 'Destination'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  waypoint_names?: string[];

  @ApiPropertyOptional({
    description: 'Additional annotations to include',
    example: ['distance', 'duration', 'speed'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  annotations?: string[];

  @ApiPropertyOptional({
    description: 'Language for instructions (ISO 639-1)',
    example: 'en'
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'Create round trip route',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  roundtrip?: boolean;

  @ApiPropertyOptional({
    description: 'Source waypoint constraint',
    example: 'first'
  })
  @IsOptional()
  @IsString()
  source?: 'first' | 'any';

  @ApiPropertyOptional({
    description: 'Destination waypoint constraint',
    example: 'last'
  })
  @IsOptional()
  @IsString()
  destination?: 'last' | 'any';

  @ApiPropertyOptional({
    description: 'Approach directions for waypoints',
    example: ['unrestricted', 'curb'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  approaches?: string[];

  @ApiPropertyOptional({
    description: 'Search radiuses for waypoints in meters',
    example: [25, 25],
    type: [Number]
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  radiuses?: number[];

  @ApiPropertyOptional({
    description: 'Road types to exclude',
    example: ['toll', 'highway'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  exclude?: string[];
}

export class AlternativeRoutesDto {
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
    enum: RouteProfile,
    example: RouteProfile.DRIVING_TRAFFIC
  })
  @IsOptional()
  @IsEnum(RouteProfile)
  profile?: RouteProfile;

  @ApiPropertyOptional({
    description: 'Maximum number of alternatives',
    example: 3,
    minimum: 1,
    maximum: 3
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3)
  max_alternatives?: number;
}

export class OptimizeRouteDto {
  @ApiProperty({
    description: 'Array of waypoints to optimize [lng, lat]',
    example: [[-74.006, 40.7128], [-73.985, 40.758], [-73.976, 40.764]],
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
    if (!Array.isArray(value) || value.length < 3) {
      throw new Error('At least 3 waypoints required for optimization');
    }
    if (value.length > 12) {
      throw new Error('Maximum 12 waypoints allowed for optimization');
    }
    return value.map((coords, index) => {
      if (!Array.isArray(coords) || coords.length !== 2) {
        throw new Error(`Invalid coordinates at waypoint ${index}`);
      }
      const [lng, lat] = coords;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error(`Invalid coordinates at waypoint ${index}`);
      }
      return coords;
    });
  })
  waypoints: [number, number][];

  @ApiPropertyOptional({
    description: 'Routing profile',
    enum: RouteProfile,
    example: RouteProfile.DRIVING_TRAFFIC
  })
  @IsOptional()
  @IsEnum(RouteProfile)
  profile?: RouteProfile;

  @ApiPropertyOptional({
    description: 'Create round trip route',
    example: false
  })
  @IsOptional()
  @IsBoolean()
  roundTrip?: boolean;

  @ApiPropertyOptional({
    description: 'Source waypoint constraint',
    example: 'first'
  })
  @IsOptional()
  @IsString()
  source?: 'first' | 'any';

  @ApiPropertyOptional({
    description: 'Destination waypoint constraint',
    example: 'last'
  })
  @IsOptional()
  @IsString()
  destination?: 'last' | 'any';

  @ApiPropertyOptional({
    description: 'Original route distance (for savings calculation)',
    example: 15000
  })
  @IsOptional()
  @IsNumber()
  originalDistance?: number;

  @ApiPropertyOptional({
    description: 'Original route duration (for savings calculation)',
    example: 1800
  })
  @IsOptional()
  @IsNumber()
  originalDuration?: number;
}

export class TrafficRouteDto {
  @ApiProperty({
    description: 'Array of waypoints [lng, lat]',
    example: [[-74.006, 40.7128], [-73.985, 40.758]],
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
    if (!Array.isArray(value) || value.length < 2) {
      throw new Error('At least 2 waypoints required');
    }
    return value.map((coords, index) => {
      if (!Array.isArray(coords) || coords.length !== 2) {
        throw new Error(`Invalid coordinates at waypoint ${index}`);
      }
      const [lng, lat] = coords;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error(`Invalid coordinates at waypoint ${index}`);
      }
      return coords;
    });
  })
  waypoints: [number, number][];

  @ApiPropertyOptional({
    description: 'Departure time (ISO string)',
    example: '2024-01-15T10:00:00Z'
  })
  @IsOptional()
  @IsDateString()
  departureTime?: string;
}

export class RouteMatchDto {
  @ApiProperty({
    description: 'GPS coordinates to match to roads [lng, lat]',
    example: [[-74.006, 40.7128], [-74.005, 40.7129], [-74.004, 40.7130]],
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
    if (!Array.isArray(value) || value.length < 2) {
      throw new Error('At least 2 coordinates required for route matching');
    }
    return value.map((coords, index) => {
      if (!Array.isArray(coords) || coords.length !== 2) {
        throw new Error(`Invalid coordinates at index ${index}`);
      }
      const [lng, lat] = coords;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error(`Invalid coordinates at index ${index}`);
      }
      return coords;
    });
  })
  coordinates: [number, number][];

  @ApiPropertyOptional({
    description: 'Timestamps for each coordinate (ISO strings)',
    example: ['2024-01-15T10:00:00Z', '2024-01-15T10:01:00Z'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsDateString({}, { each: true })
  timestamps?: string[];

  @ApiPropertyOptional({
    description: 'Routing profile for matching',
    enum: RouteProfile,
    example: RouteProfile.DRIVING
  })
  @IsOptional()
  @IsEnum(RouteProfile)
  profile?: RouteProfile;
}

export class RouteEtaDto {
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
    enum: RouteProfile,
    example: RouteProfile.DRIVING_TRAFFIC
  })
  @IsOptional()
  @IsEnum(RouteProfile)
  profile?: RouteProfile;
}

export class BatchRoutesDto {
  @ApiProperty({
    description: 'Array of origin coordinates',
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
      throw new Error('Origins array cannot be empty');
    }
    if (value.length > 10) {
      throw new Error('Maximum 10 origins allowed');
    }
    return value.map((coords, index) => {
      if (!Array.isArray(coords) || coords.length !== 2) {
        throw new Error(`Invalid origin coordinates at index ${index}`);
      }
      const [lng, lat] = coords;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        throw new Error(`Invalid coordinates at origin ${index}`);
      }
      return coords;
    });
  })
  origins: [number, number][];

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
    enum: RouteProfile,
    example: RouteProfile.DRIVING_TRAFFIC
  })
  @IsOptional()
  @IsEnum(RouteProfile)
  profile?: RouteProfile;
}