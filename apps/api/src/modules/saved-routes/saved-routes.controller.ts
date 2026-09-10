import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import {
  CreateSavedRouteDto,
  UpdateSavedRouteDto,
  UpdateSavedRouteEditorsDto,
} from './dto/saved-route.dto';
import { SavedRoutesService } from './saved-routes.service';

@ApiTags('saved-routes')
@ApiBearerAuth()
@Controller('saved-routes')
@UseGuards(FirebaseAuthGuard)
export class SavedRoutesController {
  constructor(private readonly savedRoutes: SavedRoutesService) {}

  @Get()
  list(@CurrentUser('uid') userId: string) {
    return this.savedRoutes.list(userId);
  }

  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('uid') userId: string,
  ) {
    return this.savedRoutes.get(id, userId);
  }

  @Post()
  create(@CurrentUser('uid') userId: string, @Body() dto: CreateSavedRouteDto) {
    return this.savedRoutes.create(userId, dto);
  }

  @Put(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('uid') userId: string,
    @Body() dto: UpdateSavedRouteDto,
  ) {
    return this.savedRoutes.update(id, userId, dto);
  }

  @Put(':id/editors')
  replaceEditors(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('uid') userId: string,
    @Body() dto: UpdateSavedRouteEditorsDto,
  ) {
    return this.savedRoutes.replaceEditors(id, userId, dto.userIds);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('uid') userId: string,
  ) {
    return this.savedRoutes.archive(id, userId);
  }
}
