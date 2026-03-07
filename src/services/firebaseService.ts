import firestore from '@react-native-firebase/firestore';
import { encryptionService } from './encryptionService';
import { logError } from '../utils/errorHandling';
import auth from '@react-native-firebase/auth'; 
import { UserCategoryRule } from '../types';
import CryptoJS from 'react-native-crypto-js';

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

  // Add getCurrentUserId method
  getCurrentUserId(): string | null {
    const user = auth().currentUser;
    return user ? user.uid : null;
  }

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

  // User defined category is the below two

// Save user-defined category rule (NO ENCRYPTION - it was causing wahala)
async saveUserCategoryRule(userId: string, description: string, customCategory: string): Promise<void> {
  try {
    const hash = CryptoJS.MD5(description.trim().toLowerCase()).toString();

    const rule: UserCategoryRule = {
      pattern: description,
      customCategory: customCategory,
      createdAt: firestore.FieldValue.serverTimestamp() as FirebaseFirestoreTypes.Timestamp,
    };
    
    await this.db
      .collection('users')
      .doc(userId)
      .collection('userRules')
      .doc(hash)
      .set(rule);
      
    console.log(`💾 Saved user rule: "${description}" → ${customCategory}`);
  } catch (error) {
    logError('FirebaseService.saveUserCategoryRule', error);
    throw error;
  }
}

// Get user category rule (NO ENCRYPTION - it was causing wahala)
async getUserCategoryRule(userId: string, descriptionHash: string): Promise<UserCategoryRule | null> {
  try {
    const doc = await this.db
      .collection('users')
      .doc(userId)
      .collection('userRules')
      .doc(descriptionHash)
      .get();
    
    if (!doc.exists) return null;

    const rule = doc.data() as UserCategoryRule;
    console.log(`✅ Found user rule: "${rule.pattern}" → ${rule.customCategory}`);
    return rule;
  } catch (error) {
    logError('FirebaseService.getUserCategoryRule', error);
    return null;
  }
}

// Get all custom categories for a user
async getCustomCategories(userId: string): Promise<string[]> {
  try {
    const snapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('userRules')
      .get();
    
    const categories = new Set<string>();
    snapshot.forEach(doc => {
      const rule = doc.data();
      if (rule.customCategory) {
        categories.add(rule.customCategory);
      }
    });
    
    return Array.from(categories).sort();
  } catch (error) {
    logError('FirebaseService.getCustomCategories', error);
    return [];
  }
}

// Delete custom category and all its rules
async deleteCustomCategory(userId: string, categoryName: string): Promise<void> {
  try {
    const snapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('userRules')
      .where('customCategory', '==', categoryName)
      .get();
    
    const batch = this.db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`🗑️ Deleted category "${categoryName}" and ${snapshot.size} rules`);
  } catch (error) {
    logError('FirebaseService.deleteCustomCategory', error);
    throw error;
  }
}

// Rename custom category (updates all rules using old name)
async renameCustomCategory(userId: string, oldName: string, newName: string): Promise<void> {
  try {
    const snapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('userRules')
      .where('customCategory', '==', oldName)
      .get();
    
    const batch = this.db.batch();
    snapshot.forEach(doc => {
      batch.update(doc.ref, { customCategory: newName });
    });
    
    await batch.commit();
    console.log(`✏️ Renamed category "${oldName}" → "${newName}" (${snapshot.size} rules updated)`);
  } catch (error) {
    logError('FirebaseService.renameCustomCategory', error);
    throw error;
  }
}

// Delete single user category rule
async deleteUserCategoryRule(userId: string, descriptionHash: string): Promise<void> {
  try {
    await this.db
      .collection('users')
      .doc(userId)
      .collection('userRules')
      .doc(descriptionHash)
      .delete();
    
    console.log(`🗑️ Deleted user rule: ${descriptionHash}`);
  } catch (error) {
    logError('FirebaseService.deleteUserCategoryRule', error);
    throw error;
  }
}

// Get all user rules for caching
async getAllUserRules(userId: string): Promise<{ [hash: string]: string }> {
  try {
    const snapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('userRules')
      .get();
    
    const rules: { [hash: string]: string } = {};
    snapshot.forEach(doc => {
      const rule = doc.data() as UserCategoryRule;
      const hash = doc.id;
      rules[hash] = rule.customCategory;
    });
    
    console.log(`📋 Loaded ${Object.keys(rules).length} user rules from Firebase`);
    return rules;
  } catch (error) {
    logError('FirebaseService.getAllUserRules', error);
    return {};
  }
}

// Get all rules for a specific category
async getUserRulesForCategory(userId: string, categoryName: string): Promise<UserCategoryRule[]> {
  try {
    const snapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('userRules')
      .where('customCategory', '==', categoryName)
      .get();
    
    const rules: UserCategoryRule[] = [];
    snapshot.forEach(doc => {
      rules.push(doc.data() as UserCategoryRule);
    });
    
    console.log(`📋 Found ${rules.length} rules for category "${categoryName}"`);
    return rules;
  } catch (error) {
    logError('FirebaseService.getUserRulesForCategory', error);
    return [];
  }
}

// This is the beging of the AI Memory thingy

// Save AI categorization result to firebase
async saveAIMemory(userId: string, description: string, aiCategory: string): Promise<void> {
  try {
    const hash = CryptoJS.MD5(description.trim().toLowerCase()).toString();

    const aiMemory = {
      pattern: description,
      aiCategory: aiCategory,
      createdAt: firestore.FieldValue.serverTimestamp() as FirebaseFirestoreTypes.Timestamp,
    };
    
    await this.db
      .collection('users')
      .doc(userId)
      .collection('aiMemory')
      .doc(hash)
      .set(aiMemory);
      
    console.log(`🤖 Saved AI memory: "${description}" → ${aiCategory}`);
  } catch (error) {
    logError('FirebaseService.saveAIMemory', error);
  }
}

// Get memory and do 3-month filtering
async getAllAIMemory(userId: string): Promise<{ [hash: string]: string }> {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const snapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('aiMemory')
      .where('createdAt', '>=', firestore.Timestamp.fromDate(threeMonthsAgo))
      .get();
    
    const aiMemory: { [hash: string]: string } = {};
    snapshot.forEach(doc => {
      const memory = doc.data();
      const hash = doc.id;
      aiMemory[hash] = memory.aiCategory;
    });
    
    console.log(`🤖 Loaded ${Object.keys(aiMemory).length} AI memory entries from Firebase`);
    return aiMemory;
  } catch (error) {
    logError('FirebaseService.getAllAIMemory', error);
    return {};
  }
}

// display in CategoryManagementScreen
async getAIMemoryForDisplay(userId: string): Promise<Array<{pattern: string, aiCategory: string, hash: string}>> {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const snapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('aiMemory')
      .where('createdAt', '>=', firestore.Timestamp.fromDate(threeMonthsAgo))
      .orderBy('createdAt', 'desc')
      .get();
    
    const aiMemoryDisplay: Array<{pattern: string, aiCategory: string, hash: string}> = [];
    snapshot.forEach(doc => {
      const memory = doc.data();
      aiMemoryDisplay.push({
        pattern: memory.pattern,
        aiCategory: memory.aiCategory,
        hash: doc.id
      });
    });
    
    console.log(`🤖 Loaded ${aiMemoryDisplay.length} AI memory entries for display`);
    return aiMemoryDisplay;
  } catch (error) {
    logError('FirebaseService.getAIMemoryForDisplay', error);
    return [];
  }
}

// Nowm this will move thie AI memory to userRules the moment they are edited
async moveAIMemoryToUserRule(userId: string, aiMemoryHash: string, pattern: string, newCategory: string): Promise<void> {
  try {
    // Create user rule
    await this.saveUserCategoryRule(userId, pattern, newCategory);
    
    // Delete from AI memory
    await this.db
      .collection('users')
      .doc(userId)
      .collection('aiMemory')
      .doc(aiMemoryHash)
      .delete();
    
    console.log(`✅ Moved AI memory to user rule: "${pattern}" → ${newCategory}`);
  } catch (error) {
    logError('FirebaseService.moveAIMemoryToUserRule', error);
    throw error;
  }
}

// Delete old AI memory entries 
async cleanupOldAIMemory(userId: string): Promise<void> {
  try {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const snapshot = await this.db
      .collection('users')
      .doc(userId)
      .collection('aiMemory')
      .where('createdAt', '<', firestore.Timestamp.fromDate(threeMonthsAgo))
      .get();
    
    const batch = this.db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`🗑️ Cleaned up ${snapshot.size} old AI memory entries`);
  } catch (error) {
    logError('FirebaseService.cleanupOldAIMemory', error);
  }
}

}

export const firebaseService = new FirebaseService();