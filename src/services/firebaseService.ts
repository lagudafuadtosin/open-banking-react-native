import firestore from '@react-native-firebase/firestore';
import { encryptionService } from './encryptionService';
import { logError } from '../utils/errorHandling';

// Define types for Firestore data
interface UserProfileData {
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null; // Will store encrypted value
  updatedAt: FirebaseFirestoreTypes.Timestamp;
}

interface BankConnection {
  id: string;
  institutionId: string;
  institutionName: string;
  connectedAt: FirebaseFirestoreTypes.Timestamp;
  encryptedData: string; // Store encrypted bank data
}

interface PaymentData {
  id: string;
  createdAt?: FirebaseFirestoreTypes.Timestamp; // Optional to handle missing fields
  [key: string]: any;
}

interface AccountSettings {
  settings: any;
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null; // Decrypted value
}

// Import FirebaseFirestoreTypes for proper type references
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

export class FirebaseService {
  private db = firestore();

  async saveUserProfile(user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    phoneNumber: string | null;
  }): Promise<void> {
    try {
      const { uid, email, displayName, phoneNumber } = user;
      let encryptedPhoneNumber: string | null = null;

      if (phoneNumber) {
        encryptedPhoneNumber = await encryptionService.encrypt(phoneNumber);
        if (!encryptedPhoneNumber) {
          throw new Error('Failed to encrypt phone number');
        }
      }

      const userData: UserProfileData = {
        email,
        displayName,
        phoneNumber: encryptedPhoneNumber,
        updatedAt: firestore.FieldValue.serverTimestamp() as FirebaseFirestoreTypes.Timestamp,
      };

      await this.db.collection('users').doc(uid).set(userData, { merge: true });
    } catch (error) {
      logError('FirebaseService.saveUserProfile', error);
      throw error;
    }
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDoc = await this.db.collection('users').doc(uid).get();

      if (!userDoc.exists) {
        return null;
      }

      const data = userDoc.data() as UserProfileData;

      let decryptedPhoneNumber: string | null = null;
      if (data.phoneNumber) {
        decryptedPhoneNumber = await encryptionService.decrypt(data.phoneNumber);
        if (!decryptedPhoneNumber) {
          throw new Error('Failed to decrypt phone number');
        }
      }

      return {
        uid,
        email: data.email,
        displayName: data.displayName,
        phoneNumber: decryptedPhoneNumber,
      };
    } catch (error) {
      logError('FirebaseService.getUserProfile', error);
      throw error;
    }
  }

  async saveBankConnection(userId: string, bankData: {
    institutionId: string;
    institutionName: string;
    accessToken: string;
    refreshToken: string;
  }): Promise<string> {
    try {
      const { institutionId, institutionName, accessToken, refreshToken } = bankData;

      const dataToEncrypt = JSON.stringify({ accessToken, refreshToken });
      const encryptedData = await encryptionService.encrypt(dataToEncrypt);
      if (!encryptedData) {
        throw new Error('Failed to encrypt bank data');
      }

      const bankConnection: Omit<BankConnection, 'id'> = {
        institutionId,
        institutionName,
        encryptedData,
        connectedAt: firestore.FieldValue.serverTimestamp() as FirebaseFirestoreTypes.Timestamp,
      };

      const docRef = await this.db
        .collection('users')
        .doc(userId)
        .collection('bankConnections')
        .add(bankConnection);

      return docRef.id;
    } catch (error) {
      logError('FirebaseService.saveBankConnection', error);
      throw error;
    }
  }

  async getConnectedBanks(userId: string): Promise<BankConnection[]> {
    try {
      const snapshot = await this.db
        .collection('users')
        .doc(userId)
        .collection('bankConnections')
        .get();

      const banks: BankConnection[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as Omit<BankConnection, 'id'>;
        banks.push({
          id: doc.id,
          ...data,
        });
      });

      return banks;
    } catch (error) {
      logError('FirebaseService.getConnectedBanks', error);
      throw error;
    }
  }

  async removeBankConnection(userId: string, bankId: string): Promise<void> {
    try {
      await this.db
        .collection('users')
        .doc(userId)
        .collection('bankConnections')
        .doc(bankId)
        .delete();
    } catch (error) {
      logError('FirebaseService.removeBankConnection', error);
      throw error;
    }
  }

  async getBankData(userId: string, bankId: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      const doc = await this.db
        .collection('users')
        .doc(userId)
        .collection('bankConnections')
        .doc(bankId)
        .get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data() as BankConnection;
      const decryptedData = await encryptionService.decrypt(data.encryptedData);
      if (!decryptedData) {
        throw new Error('Failed to decrypt bank data');
      }

      return JSON.parse(decryptedData);
    } catch (error) {
      logError('FirebaseService.getBankData', error);
      throw error;
    }
  }

  async savePayment(userId: string, paymentData: Record<string, any>): Promise<string> {
    try {
      const payment: Omit<PaymentData, 'id'> = {
        ...paymentData,
        createdAt: firestore.FieldValue.serverTimestamp() as FirebaseFirestoreTypes.Timestamp,
      };

      const docRef = await this.db
        .collection('users')
        .doc(userId)
        .collection('payments')
        .add(payment);

      return docRef.id;
    } catch (error) {
      logError('FirebaseService.savePayment', error);
      throw error;
    }
  }

  async getPaymentHistory(userId: string): Promise<PaymentData[]> {
    try {
      const paymentsCollection = await this.db
        .collection('users')
        .doc(userId)
        .collection('payments')
        .orderBy('createdAt', 'desc')
        .get();

      const payments: PaymentData[] = [];
      paymentsCollection.forEach(doc => {
        const data = doc.data() as Omit<PaymentData, 'id'>;
        payments.push({
          id: doc.id,
          createdAt: data.createdAt ?? firestore.Timestamp.fromDate(new Date(0)),
          ...data,
        });
      });

      return payments;
    } catch (error) {
      logError('FirebaseService.getPaymentHistory', error);
      throw error;
    }
  }

  async getPaymentById(userId: string, paymentId: string): Promise<PaymentData | null> {
    try {
      const paymentDoc = await this.db
        .collection('users')
        .doc(userId)
        .collection('payments')
        .doc(paymentId)
        .get();

      if (paymentDoc.exists) {
        const data = paymentDoc.data() as Omit<PaymentData, 'id'>;
        return {
          id: paymentDoc.id,
          createdAt: data.createdAt ?? firestore.Timestamp.fromDate(new Date(0)),
          ...data,
        };
      }

      return null;
    } catch (error) {
      logError('FirebaseService.getPaymentById', error);
      throw error;
    }
  }

  async saveAccountSettings(userId: string, settings: any): Promise<void> {
    try {
      const settingsData: AccountSettings = {
        settings,
      };

      await this.db
        .collection('users')
        .doc(userId)
        .collection('settings')
        .doc('account')
        .set(settingsData, { merge: true });
    } catch (error) {
      logError('FirebaseService.saveAccountSettings', error);
      throw error;
    }
  }

  async getAccountSettings(userId: string): Promise<any> {
    try {
      const settingsDoc = await this.db
        .collection('users')
        .doc(userId)
        .collection('settings')
        .doc('account')
        .get();

      if (!settingsDoc.exists) {
        return null;
      }

      const data = settingsDoc.data() as AccountSettings;
      return data.settings;
    } catch (error) {
      logError('FirebaseService.getAccountSettings', error);
      throw error;
    }
  }
}

export const firebaseService = new FirebaseService();
