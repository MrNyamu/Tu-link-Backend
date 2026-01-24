import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, IsEnum, MinLength, MaxLength, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

enum GeocodingType {
  COUNTRY = 'country',
  REGION = 'region',
  PLACE = 'place',
  DISTRICT = 'district',
  LOCALITY = 'locality',
  NEIGHBORHOOD = 'neighborhood',
  ADDRESS = 'address',
  POI = 'poi'
}

export class GeocodeSearchDto {
  @ApiProperty({
    description: 'Search query (address, place name, etc.)',
    example: 'Times Square, New York',
    minLength: 1,
    maxLength: 500
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  query: string;

  @ApiPropertyOptional({
    description: 'Proximity point to bias results [lng, lat]',
    example: [-74.006, 40.7128],
    type: [Number]
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Transform(({ value }) => {
    if (!value) return value;
    if (Array.isArray(value) && value.length === 2) {
      const [lng, lat] = value;
      if (lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
        return value;
      }
    }
    throw new Error('Invalid proximity coordinates');
  })
  proximity?: [number, number];

  @ApiPropertyOptional({
    description: 'Bounding box to limit results [minLng, minLat, maxLng, maxLat]',
    example: [-74.1, 40.6, -73.9, 40.8],
    type: [Number]
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Transform(({ value }) => {
    if (!value) return value;
    if (Array.isArray(value) && value.length === 4) {
      const [minLng, minLat, maxLng, maxLat] = value;
      if (minLng >= -180 && minLng <= 180 && minLat >= -90 && minLat <= 90 &&
          maxLng >= -180 && maxLng <= 180 && maxLat >= -90 && maxLat <= 90 &&
          minLng < maxLng && minLat < maxLat) {
        return value;
      }
    }
    throw new Error('Invalid bbox coordinates');
  })
  bbox?: [number, number, number, number];

  @ApiPropertyOptional({
    description: 'Country codes to limit results (ISO 3166-1 alpha-2)',
    example: ['US', 'CA'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (!value) return value;
    return Array.isArray(value) ? value.map(c => c.toUpperCase()) : [value.toUpperCase()];
  })
  countries?: string[];

  @ApiPropertyOptional({
    description: 'Feature types to filter results',
    enum: GeocodingType,
    isArray: true,
    example: ['place', 'address']
  })
  @IsOptional()
  @IsArray()
  @IsEnum(GeocodingType, { each: true })
  types?: GeocodingType[];

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    example: 10,
    minimum: 1,
    maximum: 10
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Enable autocomplete for partial queries',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  autocomplete?: boolean;

  @ApiPropertyOptional({
    description: 'Languages for results (ISO 639-1 codes)',
    example: ['en'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (!value) return value;
    if (typeof value === 'string') return [value.toLowerCase()];
    return Array.isArray(value) ? value.map(lang => lang.toLowerCase()) : [value.toLowerCase()];
  })
  language?: string[];
}

export class ReverseGeocodeDto {
  @ApiProperty({
    description: 'Coordinates to reverse geocode [lng, lat]',
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

  @ApiPropertyOptional({
    description: 'Feature types to filter results',
    enum: GeocodingType,
    isArray: true,
    example: ['place', 'address']
  })
  @IsOptional()
  @IsArray()
  @IsEnum(GeocodingType, { each: true })
  types?: GeocodingType[];

  @ApiPropertyOptional({
    description: 'Languages for results (ISO 639-1 codes)',
    example: ['en'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (!value) return value;
    if (typeof value === 'string') return [value.toLowerCase()];
    return Array.isArray(value) ? value.map(lang => lang.toLowerCase()) : [value.toLowerCase()];
  })
  language?: string[];
}

export class BatchGeocodeDto {
  @ApiProperty({
    description: 'Array of search queries',
    example: ['Times Square, NYC', 'Central Park, NYC', 'Brooklyn Bridge'],
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value) && value.length <= 10) { // Limit batch size
      return value.filter(q => q && q.trim().length > 0);
    }
    throw new Error('Invalid queries array or too many queries (max 10)');
  })
  queries: string[];

  @ApiPropertyOptional({
    description: 'Proximity point to bias results [lng, lat]',
    example: [-74.006, 40.7128],
    type: [Number]
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  proximity?: [number, number];

  @ApiPropertyOptional({
    description: 'Country codes to limit results',
    example: ['US'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiPropertyOptional({
    description: 'Feature types to filter results',
    enum: GeocodingType,
    isArray: true
  })
  @IsOptional()
  @IsArray()
  @IsEnum(GeocodingType, { each: true })
  types?: GeocodingType[];

  @ApiPropertyOptional({
    description: 'Languages for results (ISO 639-1 codes)',
    example: ['en'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (!value) return value;
    if (typeof value === 'string') return [value.toLowerCase()];
    return Array.isArray(value) ? value.map(lang => lang.toLowerCase()) : [value.toLowerCase()];
  })
  language?: string[];
}

export class PlaceDetailsDto {
  @ApiProperty({
    description: 'Mapbox place ID',
    example: 'place.123456789'
  })
  @IsString()
  @MinLength(1)
  placeId: string;
}

export class SearchNearbyDto {
  @ApiProperty({
    description: 'Center coordinates [lng, lat]',
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
    throw new Error('Invalid center coordinates');
  })
  center: [number, number];

  @ApiProperty({
    description: 'Search radius in meters',
    example: 1000,
    minimum: 10,
    maximum: 50000
  })
  @IsNumber()
  @Min(10)
  @Max(50000)
  radius: number;

  @ApiPropertyOptional({
    description: 'Search query (optional)',
    example: 'restaurant'
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;

  @ApiPropertyOptional({
    description: 'Feature types to search',
    enum: GeocodingType,
    isArray: true,
    example: ['poi']
  })
  @IsOptional()
  @IsArray()
  @IsEnum(GeocodingType, { each: true })
  types?: GeocodingType[];

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    example: 10,
    minimum: 1,
    maximum: 20
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  limit?: number;
}

export class AutocompleteDto {
  @ApiProperty({
    description: 'Partial search query',
    example: 'Times Sq',
    minLength: 2,
    maxLength: 200
  })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  query: string;

  @ApiPropertyOptional({
    description: 'Proximity point to bias results [lng, lat]',
    example: [-74.006, 40.7128],
    type: [Number]
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  proximity?: [number, number];

  @ApiPropertyOptional({
    description: 'Country codes to limit results',
    example: ['US'],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @ApiPropertyOptional({
    description: 'Feature types to filter results',
    enum: GeocodingType,
    isArray: true
  })
  @IsOptional()
  @IsArray()
  @IsEnum(GeocodingType, { each: true })
  types?: GeocodingType[];

  @ApiPropertyOptional({
    description: 'Maximum number of suggestions',
    example: 5,
    minimum: 1,
    maximum: 10
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  limit?: number;
}