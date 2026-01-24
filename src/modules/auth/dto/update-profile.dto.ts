import { IsString, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({
    description: 'Updated display name',
    example: 'John Smith',
    required: false
  })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({
    description: 'Updated phone number in E.164 format',
    example: '+254722519316',
    required: false,
    pattern: '^\\+[1-9]\\d{1,14}$'
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format (e.g., +254722519316)',
  })
  phoneNumber?: string;
}
