import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { SavedRouteSource } from '../../../database/repositories/saved-route.repository';

export class SavedRoutePointDto {
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class SavedRouteGeometryPointDto {
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude: number;
}

export class CreateSavedRouteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsIn(['COMPUTED', 'RECORDED', 'MANUAL'])
  source: SavedRouteSource;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => SavedRoutePointDto)
  waypoints: SavedRoutePointDto[];

  /** Required for RECORDED/MANUAL. Ignored for COMPUTED routes. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20000)
  @ValidateNested({ each: true })
  @Type(() => SavedRouteGeometryPointDto)
  geometry?: SavedRouteGeometryPointDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2)
  routeIndex?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  recordedDurationSeconds?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  editorUserIds?: string[];
}

export class UpdateSavedRouteDto extends CreateSavedRouteDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class UpdateSavedRouteEditorsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  userIds: string[];
}

export class ApplySavedRouteDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  baseVersion: number;

  @IsString()
  requestId: string;
}
