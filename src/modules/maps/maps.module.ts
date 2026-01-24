import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import mapsConfig from '../../config/maps.config';
import { RedisModule } from '../../shared/redis/redis.module';

// Services
import { MapboxService } from './services/mapbox.service';
import { GeocodingService } from './services/geocoding.service';
import { RoutingService } from './services/routing.service';
import { MatrixService } from './services/matrix.service';
import { NavigationService } from './services/navigation.service';
import { OptimizedNavigationService } from './services/optimized-navigation.service';
import { JourneyVisualizationService } from './services/journey-visualization.service';

// Controller
import { MapsController } from './maps.controller';

@Module({
  imports: [
    ConfigModule.forFeature(mapsConfig),
    RedisModule
  ],
  providers: [
    MapboxService,
    GeocodingService,
    RoutingService,
    MatrixService,
    NavigationService,
    OptimizedNavigationService,
    JourneyVisualizationService
  ],
  controllers: [MapsController],
  exports: [
    MapboxService,
    GeocodingService,
    RoutingService,
    MatrixService,
    NavigationService,
    OptimizedNavigationService,
    JourneyVisualizationService
  ]
})
export class MapsModule {}
