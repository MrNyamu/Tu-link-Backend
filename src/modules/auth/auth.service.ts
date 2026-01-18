import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseService } from '../../shared/firebase/firebase.service';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from '../../shared/interfaces/user.interface';
import { FieldValue } from 'firebase-admin/firestore';

@Injectable()
export class AuthService {
  constructor(private firebaseService: FirebaseService) {}

  async register(registerDto: RegisterDto): Promise<{ uid: string }> {
    try {
      // Create Firebase Auth user
      const userRecord =
        await this.firebaseService.auth.createUser({
          email: registerDto.email,
          password: registerDto.password,
          displayName: registerDto.displayName,
          phoneNumber: registerDto.phoneNumber,
        });

      // Create Firestore user document
      const userData = {
        email: registerDto.email,
        displayName: registerDto.displayName,
        phoneNumber: registerDto.phoneNumber,
        createdAt: FieldValue.serverTimestamp() as any,
        updatedAt: FieldValue.serverTimestamp() as any,
      };

      await this.firebaseService.firestore
        .collection('users')
        .doc(userRecord.uid)
        .set(userData);

      return { uid: userRecord.uid };
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  async getProfile(uid: string): Promise<User> {
    const userDoc = await this.firebaseService.firestore
      .collection('users')
      .doc(uid)
      .get();

    if (!userDoc.exists) {
      throw new NotFoundException('User not found');
    }

    return { id: userDoc.id, ...userDoc.data() } as User;
  }

  async updateProfile(
    uid: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<User> {
    const updateData: any = {
      ...updateProfileDto,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Update Firebase Auth
    await this.firebaseService.auth.updateUser(uid, updateProfileDto);

    // Update Firestore
    await this.firebaseService.firestore
      .collection('users')
      .doc(uid)
      .update(updateData);

    return this.getProfile(uid);
  }

  async verifyToken(token: string): Promise<any> {
    try {
      return await this.firebaseService.auth.verifyIdToken(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
