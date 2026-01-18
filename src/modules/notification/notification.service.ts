import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../shared/firebase/firebase.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification } from '../../shared/interfaces/notification.interface';
import { NotificationType } from '../../types/notification.type';
import { FieldValue } from 'firebase-admin/firestore';

@Injectable()
export class NotificationService {
  constructor(private firebaseService: FirebaseService) {}

  /**
   * Create and send a notification
   */
  async createNotification(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    const notificationRef = this.firebaseService.firestore
      .collection('journeys')
      .doc(createNotificationDto.journeyId)
      .collection('notifications')
      .doc();

    const notificationData = {
      journeyId: createNotificationDto.journeyId,
      recipientId: createNotificationDto.recipientId,
      type: createNotificationDto.type,
      title: createNotificationDto.title,
      body: createNotificationDto.body,
      data: createNotificationDto.data,
      read: false,
      createdAt: FieldValue.serverTimestamp() as any,
    };

    await notificationRef.set(notificationData);

    // TODO: Send FCM push notification (requires FCM token registration)
    // await this.sendPushNotification(createNotificationDto.recipientId, notificationData);

    return { id: notificationRef.id, ...notificationData } as Notification;
  }

  /**
   * Send journey invite notification
   */
  async sendJourneyInvite(
    journeyId: string,
    journeyName: string,
    recipientId: string,
    inviterName: string,
  ): Promise<void> {
    await this.createNotification({
      journeyId,
      recipientId,
      type: 'JOURNEY_INVITE',
      title: 'Journey Invitation',
      body: `${inviterName} invited you to join "${journeyName}"`,
      data: { journeyId, inviterName },
    });
  }

  /**
   * Send journey started notification
   */
  async sendJourneyStarted(journeyId: string, recipientIds: string[]): Promise<void> {
    const notifications = recipientIds.map((recipientId) =>
      this.createNotification({
        journeyId,
        recipientId,
        type: 'JOURNEY_STARTED',
        title: 'Journey Started',
        body: 'The journey has begun!',
        data: { journeyId },
      }),
    );

    await Promise.all(notifications);
  }

  /**
   * Send journey ended notification
   */
  async sendJourneyEnded(journeyId: string, recipientIds: string[]): Promise<void> {
    const notifications = recipientIds.map((recipientId) =>
      this.createNotification({
        journeyId,
        recipientId,
        type: 'JOURNEY_ENDED',
        title: 'Journey Completed',
        body: 'The journey has ended',
        data: { journeyId },
      }),
    );

    await Promise.all(notifications);
  }

  /**
   * Send lag alert notification
   */
  async sendLagAlert(
    journeyId: string,
    userId: string,
    distance: number,
    severity: 'WARNING' | 'CRITICAL',
  ): Promise<void> {
    const title = severity === 'CRITICAL' ? 'Critical Lag Alert' : 'Lag Warning';
    const body = `You are ${Math.round(distance)}m behind the leader`;

    await this.createNotification({
      journeyId,
      recipientId: userId,
      type: 'LAG_ALERT',
      title,
      body,
      data: { distance, severity },
    });
  }

  /**
   * Send participant joined notification
   */
  async sendParticipantJoined(
    journeyId: string,
    participantName: string,
    recipientIds: string[],
  ): Promise<void> {
    const notifications = recipientIds.map((recipientId) =>
      this.createNotification({
        journeyId,
        recipientId,
        type: 'PARTICIPANT_JOINED',
        title: 'Participant Joined',
        body: `${participantName} joined the journey`,
        data: { participantName },
      }),
    );

    await Promise.all(notifications);
  }

  /**
   * Send arrival detected notification
   */
  async sendArrivalDetected(
    journeyId: string,
    participantName: string,
    recipientIds: string[],
  ): Promise<void> {
    const notifications = recipientIds.map((recipientId) =>
      this.createNotification({
        journeyId,
        recipientId,
        type: 'ARRIVAL_DETECTED',
        title: 'Arrival Detected',
        body: `${participantName} has arrived at the destination`,
        data: { participantName },
      }),
    );

    await Promise.all(notifications);
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    const snapshot = await this.firebaseService.firestore
      .collectionGroup('notifications')
      .where('recipientId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Notification[];
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, journeyId: string): Promise<void> {
    await this.firebaseService.firestore
      .collection('journeys')
      .doc(journeyId)
      .collection('notifications')
      .doc(notificationId)
      .update({
        read: true,
        readAt: FieldValue.serverTimestamp(),
      });
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, journeyId: string): Promise<void> {
    await this.firebaseService.firestore
      .collection('journeys')
      .doc(journeyId)
      .collection('notifications')
      .doc(notificationId)
      .delete();
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const snapshot = await this.firebaseService.firestore
      .collectionGroup('notifications')
      .where('recipientId', '==', userId)
      .where('read', '==', false)
      .get();

    return snapshot.size;
  }

  /**
   * Send FCM push notification
   * TODO: Implement when FCM tokens are registered
   */
  private async sendPushNotification(userId: string, notification: any): Promise<void> {
    // Implementation requires:
    // 1. Device token registration endpoint
    // 2. Store FCM tokens in Firestore
    // 3. Use Firebase Admin SDK to send messages

    // Example implementation:
    // const userDoc = await this.firebaseService.firestore
    //   .collection('users')
    //   .doc(userId)
    //   .get();
    //
    // const fcmToken = userDoc.data()?.fcmToken;
    // if (!fcmToken) return;
    //
    // await this.firebaseService.app.messaging().send({
    //   token: fcmToken,
    //   notification: {
    //     title: notification.title,
    //     body: notification.body,
    //   },
    //   data: notification.data,
    // });

    console.log(`Push notification would be sent to user ${userId}`);
  }
}
