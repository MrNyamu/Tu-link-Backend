import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class CoordinatesDto {
  @ApiProperty({
    description: 'Longitude',
    example: -74.006,
    minimum: -180,
    maximum: 180
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @ApiProperty({
    description: 'Latitude',
    example: 40.7128,
    minimum: -90,
    maximum: 90
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;
}

export class CoordinatePairDto {
  @ApiProperty({
    description: 'Coordinates as [longitude, latitude] array',
    example: [-74.006, 40.7128],
    type: [Number]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value) && value.length === 2) {
      const [lng, lat] = value;
      if (lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
        return value;
      }
    }
    throw new Error('Invalid coordinates format or values');
  })
  coordinates: [number, number];
}

export class BoundingBoxDto {
  @ApiProperty({
    description: 'Minimum longitude',
    example: -74.1,
    minimum: -180,
    maximum: 180
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  minLng: number;

  @ApiProperty({
    description: 'Minimum latitude',
    example: 40.6,
    minimum: -90,
    maximum: 90
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  minLat: number;

  @ApiProperty({
    description: 'Maximum longitude',
    example: -73.9,
    minimum: -180,
    maximum: 180
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  maxLng: number;

  @ApiProperty({
    description: 'Maximum latitude',
    example: 40.8,
    minimum: -90,
    maximum: 90
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  maxLat: number;
}