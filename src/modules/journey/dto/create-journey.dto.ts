import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class LocationDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}

export class CreateJourneyDto {
  @IsString()
  name: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  destination?: LocationDto;

  @IsOptional()
  @IsString()
  destinationAddress?: string;

  @IsOptional()
  @IsNumber()
  @Min(100)
  lagThresholdMeters?: number;
}
