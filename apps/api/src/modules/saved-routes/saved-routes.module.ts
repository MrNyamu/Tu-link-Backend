import { Module } from '@nestjs/common';
import { MapsModule } from '../maps/maps.module';
import { SavedRoutesController } from './saved-routes.controller';
import { SavedRoutesService } from './saved-routes.service';
import { OperatorModule } from '../operator/operator.module';
import { SavedRoutesOperatorController } from './saved-routes-operator.controller';

@Module({
  imports: [MapsModule, OperatorModule],
  controllers: [SavedRoutesController, SavedRoutesOperatorController],
  providers: [SavedRoutesService],
  exports: [SavedRoutesService],
})
export class SavedRoutesModule {}
