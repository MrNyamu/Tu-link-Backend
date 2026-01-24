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
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Get the count of unread notifications for the current user'
  })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
    schema: {
      example: {
        count: 5
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(@CurrentUser('uid') userId: string) {
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  /**
   * Mark notification as read
   */
  @Put(':journeyId/:notificationId/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Mark a specific notification as read'
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Notification marked as read'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
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
<<<<<<< Updated upstream
  @Delete(':journeyId/:notificationId')
  @HttpCode(HttpStatus.NO_CONTENT)
=======
  @Delete(':notificationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete notification',
    description: 'Delete a specific notification from user\'s notification list'
  })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'Notification deleted successfully'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
>>>>>>> Stashed changes
  async deleteNotification(
    @Param('journeyId') journeyId: string,
    @Param('notificationId') notificationId: string,
  ) {
    await this.notificationService.deleteNotification(notificationId, journeyId);
  }
}
