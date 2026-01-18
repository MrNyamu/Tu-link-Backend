import { Timestamp, GeoPoint } from 'firebase-admin/firestore';
import { JourneyStatus } from '../../types/journey-status.type';

export interface Journey {
  id: string;
  name: string;
  leaderId: string;
  status: JourneyStatus;
  startTime?: Timestamp;
  endTime?: Timestamp;
  destination?: GeoPoint;
  destinationAddress?: string;
  lagThresholdMeters: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata: {
    totalDistance?: number;
    estimatedDuration?: number;
  };
}
