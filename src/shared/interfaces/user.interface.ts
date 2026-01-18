import { Timestamp } from 'firebase-admin/firestore';

export interface User {
  id: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
