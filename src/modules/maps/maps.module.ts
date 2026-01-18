import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MapsService } from './services/maps.service';
import mapsConfig from '../../config/maps.config';

@Module({
  imports: [ConfigModule.forFeature(mapsConfig)],
  providers: [MapsService],
  exports: [MapsService],
})
export class MapsModule {}
