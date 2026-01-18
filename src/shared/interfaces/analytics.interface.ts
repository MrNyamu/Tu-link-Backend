import { Timestamp } from 'firebase-admin/firestore';

export interface JourneyAnalytics {
  id: string;
  journeyId: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  totalDuration?: number;
  totalDistance: number;
  averageSpeed: number;
  maxLagDistance: number;
  lagAlertCount: number;
  participantCount: number;
  routePolyline?: string;
  stats: {
    leaderStops: number;
    avgFollowerLag: number;
    connectionDrops: number;
  };
}
