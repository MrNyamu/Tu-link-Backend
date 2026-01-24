import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@tulink.xyz',
    format: 'email'
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password (minimum 6 characters)',
    example: 'SecurePass123!',
    minLength: 6
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Display name for the user',
    example: 'John Doe'
  })
  @IsString()
  displayName: string;

  @ApiProperty({
    description: 'Phone number in E.164 format (optional)',
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
