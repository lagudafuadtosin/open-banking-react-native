import * as Keychain from 'react-native-keychain';
import { logError } from '../utils/errorHandling';

export class SecureStorage {
  // Store a value securely

  async setItem(key: string, value: string): Promise<boolean> {
    try {
      await Keychain.setGenericPassword(key, value, {
        service: key,
      });
      return true;
    } catch (error) {
      logError(`SecureStorage.setItem (${key})`, error);
      return false;
    }
  }
  
  // Retrieve a value from secure storage
   
  async getItem(key: string): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: key,
      });
      
      if (credentials) {
        return credentials.password;
      }
      return null;
    } catch (error) {
      logError(`SecureStorage.getItem (${key})`, error);
      return null;
    }
  }
  
  // Remove a value from secure storage
  
  async removeItem(key: string): Promise<boolean> {
    try {
      await Keychain.resetGenericPassword({
        service: key,
      });
      return true;
    } catch (error) {
      logError(`SecureStorage.removeItem (${key})`, error);
      return false;
    }
  }
  
  // Store user credentials for biometric login
  
  async storeUserCredentials(email: string, password: string): Promise<boolean> {
    try {
      await Keychain.setGenericPassword(email, password, {
        service: 'userCredentials',
      });
      return true;
    } catch (error) {
      logError('SecureStorage.storeUserCredentials', error);
      return false;
    }
  }
  
  // Get stored user credentials
  
  async getUserCredentials(): Promise<{ email: string; password: string } | null> {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: 'userCredentials',
      });
      
      if (credentials) {
        return {
          email: credentials.username,
          password: credentials.password,
        };
      }
      return null;
    } catch (error) {
      logError('SecureStorage.getUserCredentials', error);
      return null;
    }
  }

  // Clear stored user credentials
   
  async clearUserCredentials(): Promise<boolean> {
    try {
      await Keychain.resetGenericPassword({
        service: 'userCredentials',
      });
      return true;
    } catch (error) {
      logError('SecureStorage.clearUserCredentials', error);
      return false;
    }
  }
}

export const secureStorage = new SecureStorage();