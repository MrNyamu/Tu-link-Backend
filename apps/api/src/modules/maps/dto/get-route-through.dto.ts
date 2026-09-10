import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsLatitude,
  IsLongitude,
  IsNumber,
  ValidateNested,
} from 'class-validator';

export class RouteWaypointDto {
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude: number;
}

export class GetRouteThroughDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => RouteWaypointDto)
  waypoints: RouteWaypointDto[];
}
