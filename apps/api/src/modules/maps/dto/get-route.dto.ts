import { IsLatitude, IsLongitude, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class GetRouteDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'originLat must be a valid number' })
  @IsLatitude({ message: 'originLat must be between -90 and 90' })
  originLat: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'originLng must be a valid number' })
  @IsLongitude({ message: 'originLng must be between -180 and 180' })
  originLng: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'destLat must be a valid number' })
  @IsLatitude({ message: 'destLat must be between -90 and 90' })
  destLat: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'destLng must be a valid number' })
  @IsLongitude({ message: 'destLng must be between -180 and 180' })
  destLng: number;
}
