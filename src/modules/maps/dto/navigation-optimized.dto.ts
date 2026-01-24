import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CompactRouteDto {
  @ApiProperty({
    description: 'Compressed route geometry (encoded polyline)',
    example: '_p~iF~ps|U_ulLnnqC_mqNvxq`@'
  })
  @IsString()
  geometry: string;

  @ApiProperty({
    description: 'Route segment distances (meters)',
    type: [Number]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  distances: number[];

  @ApiProperty({
    description: 'Route segment durations (seconds)',
    type: [Number]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  durations: number[];

  @ApiProperty({
    description: 'Turn-by-turn instruction indices',
    type: [Number]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  instructionIndices: number[];

  @ApiProperty({
    description: 'Compressed instructions',
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  instructions: string[];
}

export class NavigationChunkRequestDto {
  @ApiProperty({
    description: 'Navigation session ID',
    example: 'nav-session-12345'
  })
  @IsString()
  sessionId: string;

  @ApiProperty({
    description: 'Current position index on route',
    example: 150
  })
  @IsNumber()
  @Min(0)
  currentIndex: number;

  @ApiPropertyOptional({
    description: 'Number of route segments to fetch ahead',
    example: 50,
    default: 50
  })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(200)
  lookAhead?: number;

  @ApiPropertyOptional({
    description: 'Include voice instructions',
    example: true,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  includeVoice?: boolean;
}

export class NavigationUpdateOptimizedDto {
  @ApiProperty({
    description: 'Current location [lng, lat]',
    example: [-74.006, 40.7128],
    type: [Number]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  currentLocation: [number, number];

  @ApiPropertyOptional({
    description: 'Current heading in degrees',
    example: 45,
    minimum: 0,
    maximum: 360
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @ApiPropertyOptional({
    description: 'Current speed in m/s',
    example: 13.89
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  speed?: number;

  @ApiPropertyOptional({
    description: 'Request next route chunk',
    example: true,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  requestNextChunk?: boolean;
}

export class NavigationChunkResponseDto {
  @ApiProperty({
    description: 'Route chunk data',
    type: CompactRouteDto
  })
  chunk: CompactRouteDto;

  @ApiProperty({
    description: 'Chunk start index',
    example: 100
  })
  startIndex: number;

  @ApiProperty({
    description: 'Chunk end index',
    example: 150
  })
  endIndex: number;

  @ApiProperty({
    description: 'Total route segments',
    example: 500
  })
  totalSegments: number;

  @ApiPropertyOptional({
    description: 'Voice instructions for this chunk',
    type: [Object]
  })
  voiceInstructions?: Array<{
    index: number;
    text: string;
    distance: number;
  }>;
}

export class ProgressiveNavigationResponseDto {
  @ApiProperty({
    description: 'Current progress information'
  })
  progress: {
    currentIndex: number;
    distanceRemaining: number;
    durationRemaining: number;
    fractionCompleted: number;
  };

  @ApiProperty({
    description: 'Next instruction'
  })
  nextInstruction: {
    text: string;
    distance: number;
    type: string;
  };

  @ApiPropertyOptional({
    description: 'Route chunk if requested'
  })
  chunk?: NavigationChunkResponseDto;

  @ApiProperty({
    description: 'Whether rerouting is needed'
  })
  rerouteRequired: boolean;

  @ApiProperty({
    description: 'Estimated arrival time'
  })
  estimatedArrival: Date;
}