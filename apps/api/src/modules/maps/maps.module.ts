import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MapsService } from './services/maps.service';
import { MapsController } from './controllers/maps.controller';
import mapsConfig from '../../config/maps.config';
import { ValhallaRoutingService } from './services/valhalla-routing.service';

@Module({
  imports: [ConfigModule.forFeature(mapsConfig)],
  controllers: [MapsController],
  providers: [MapsService, ValhallaRoutingService],
  exports: [MapsService],
})
export class MapsModule {}
