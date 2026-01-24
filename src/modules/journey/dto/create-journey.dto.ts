import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class LocationDto {
  @ApiProperty({
    description: 'Latitude coordinate',
    example: -1.2921,
    minimum: -90,
    maximum: 90
  })
  @IsNumber()
  latitude: number;

  @ApiProperty({
    description: 'Longitude coordinate',
    example: 36.8219,
    minimum: -180,
    maximum: 180
  })
  @IsNumber()
  longitude: number;
}

export class CreateJourneyDto {
  @ApiProperty({
    description: 'Journey name/title',
    example: 'Weekend Road Trip to Mombasa'
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Journey destination coordinates',
    example: {
      latitude: -4.0435,
      longitude: 39.6682
    },
    required: false
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  destination?: LocationDto;

  @ApiProperty({
    description: 'Human-readable destination address',
    example: 'Mombasa, Kenya',
    required: false
  })
  @IsOptional()
  @IsString()
  destinationAddress?: string;

  @ApiProperty({
    description: 'Distance threshold in meters for lag detection',
    example: 500,
    minimum: 100,
    required: false
  })
  @IsOptional()
  @IsNumber()
  @Min(100)
  lagThresholdMeters?: number;
}
