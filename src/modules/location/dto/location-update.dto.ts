import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class LocationCoordinateDto {
  @ApiProperty({
    description: 'GPS latitude coordinate',
    example: -1.2921,
    minimum: -90,
    maximum: 90
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: 'GPS longitude coordinate',
    example: 36.8219,
    minimum: -180,
    maximum: 180
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

class MetadataDto {
  @ApiProperty({
    description: 'Device battery level percentage',
    example: 75,
    minimum: 0,
    maximum: 100,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  batteryLevel?: number;

  @ApiProperty({
    description: 'Whether the device is currently moving',
    example: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  isMoving?: boolean;

  @ApiProperty({
    description: 'Whether this update indicates a status change',
    example: false,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  statusChange?: boolean;
}

export class LocationUpdateDto {
  @ApiProperty({
    description: 'Journey ID this location update belongs to',
    example: 'journey_abc123'
  })
  @IsString()
  journeyId: string;

  @ApiProperty({
    description: 'GPS coordinates',
    example: {
      latitude: -1.2921,
      longitude: 36.8219
    }
  })
  @ValidateNested()
  @Type(() => LocationCoordinateDto)
  location: LocationCoordinateDto;

  @ApiProperty({
    description: 'GPS accuracy in meters',
    example: 5.2,
    minimum: 0
  })
  @IsNumber()
  @Min(0)
  accuracy: number;

  @ApiProperty({
    description: 'Compass heading in degrees (0-360)',
    example: 45,
    minimum: 0,
    maximum: 360,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @ApiProperty({
    description: 'Speed in km/h',
    example: 25.5,
    minimum: 0,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  speed?: number;

  @ApiProperty({
    description: 'Altitude in meters above sea level',
    example: 1795,
    required: false
  })
  @IsOptional()
  @IsNumber()
  altitude?: number;

  @ApiProperty({
    description: 'Unix timestamp in milliseconds',
    example: 1737712200000
  })
  @IsNumber()
  timestamp: number;

  @ApiProperty({
    description: 'Additional metadata about the device/location',
    required: false,
    example: {
      batteryLevel: 75,
      isMoving: true,
      statusChange: false
    }
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MetadataDto)
  metadata?: MetadataDto;
}
