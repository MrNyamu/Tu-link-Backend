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
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ClerkAuthGuard,
  type ClerkRequest,
} from '../../common/guards/clerk-auth.guard';
import {
  CreateSavedRouteDto,
  UpdateSavedRouteDto,
} from './dto/saved-route.dto';
import { SavedRoutesService } from './saved-routes.service';

@Controller('operator/saved-routes')
@UseGuards(ClerkAuthGuard)
export class SavedRoutesOperatorController {
  constructor(private readonly savedRoutes: SavedRoutesService) {}

  @Get()
  list(@Req() request: ClerkRequest) {
    const identity = this.identity(request);
    return this.savedRoutes.listForOperator(identity.orgId, identity.userId);
  }

  @Post()
  create(@Req() request: ClerkRequest, @Body() dto: CreateSavedRouteDto) {
    const identity = this.identity(request);
    return this.savedRoutes.createForOperator(
      identity.orgId,
      identity.userId,
      dto,
    );
  }

  @Put(':id')
  update(
    @Req() request: ClerkRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSavedRouteDto,
  ) {
    const identity = this.identity(request);
    return this.savedRoutes.updateForOperator(
      id,
      identity.orgId,
      identity.userId,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(
    @Req() request: ClerkRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    const identity = this.identity(request);
    return this.savedRoutes.archiveForOperator(
      id,
      identity.orgId,
      identity.userId,
    );
  }

  private identity(request: ClerkRequest) {
    const userId = request.clerkAuth?.userId;
    const orgId = request.clerkAuth?.orgId;
    if (!userId || !orgId) {
      throw new UnauthorizedException('Active Clerk organization required');
    }
    return { userId, orgId };
  }
}
