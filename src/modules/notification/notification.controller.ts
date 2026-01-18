import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { FirebaseAuthGuard } from '../../common/guards/firebase-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(FirebaseAuthGuard)
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  /**
   * Get user's notifications
   */
  @Get()
  async getUserNotifications(
    @CurrentUser('uid') userId: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.notificationService.getUserNotifications(userId, limit || 50);
  }

  /**
   * Get unread notification count
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser('uid') userId: string) {
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  /**
   * Mark notification as read
   */
  @Put(':journeyId/:notificationId/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Param('journeyId') journeyId: string,
    @Param('notificationId') notificationId: string,
  ) {
    await this.notificationService.markAsRead(notificationId, journeyId);
    return { message: 'Notification marked as read' };
  }

  /**
   * Delete notification
   */
  @Delete(':journeyId/:notificationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @Param('journeyId') journeyId: string,
    @Param('notificationId') notificationId: string,
  ) {
    await this.notificationService.deleteNotification(notificationId, journeyId);
  }
}
