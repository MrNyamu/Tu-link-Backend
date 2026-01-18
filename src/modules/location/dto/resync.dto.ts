import { IsNumber, Min } from 'class-validator';

export class ResyncDto {
  @IsNumber()
  @Min(0)
  fromSequence: number;
}
