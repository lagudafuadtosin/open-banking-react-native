import { secureStorage } from './secureStorage';
import { logError } from '../utils/errorHandling';
import CryptoJS from 'react-native-crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEVELOPMENT_ENCRYPTION_KEY } from '@env'; // Failing to get the one from the emulator to work

const useAsyncStorage = true; // <-- Added flag (set to false to disbale Asyncstorage and make more secure app)

// Handles encryption/decryption of sensitive data using AES
export class EncryptionService {
  private encryptionKey: string | null = null;
  private readonly keyStorageKey = 'encryptionKey';
  private initPromise: Promise<void>;
  private initialized: boolean = false;

  constructor() {
    // Start initialization right away
    this.initPromise = this.initialize();
  }

  // Makes sure service is initialized before using it
  async ensureInitialized(): Promise<void> {
    if (this.initialized && this.encryptionKey) {
      return Promise.resolve();
    }
    return this.initPromise;
  }

  // Sets up the encryption key - for this dissertaion only prioritizes env
  private async initialize() {
    try {
      console.log('Initializing encryption service...');
      
      if (DEVELOPMENT_ENCRYPTION_KEY) {
        this.encryptionKey = DEVELOPMENT_ENCRYPTION_KEY;
        
        // Save to storage for consistency
        try {
          await secureStorage.setItem(this.keyStorageKey, this.encryptionKey);
          if (useAsyncStorage) {
            await AsyncStorage.setItem(this.keyStorageKey, this.encryptionKey);
          }
        } catch (error) {
          console.log('Failed to save dev key to storage:', error);
        }
        
        this.initialized = true;
        return;
      }
      
      // Try AsyncStorage first as it's faster (leave for now, resolve later)
      if (!this.encryptionKey) {
        try {
          if (useAsyncStorage) {
            this.encryptionKey = await AsyncStorage.getItem(this.keyStorageKey);
            if (this.encryptionKey) {
              console.log('Found key in AsyncStorage');
            }
          }
        } catch (error) {
          console.log('Failed to load from AsyncStorage');
        }
      }
      
      // Then try secure storage
      if (!this.encryptionKey) {
        try {
          this.encryptionKey = await secureStorage.getItem(this.keyStorageKey);
          if (this.encryptionKey) {
            console.log('Found key in secure storage');
            
            // Keep a backup in AsyncStorage
            if (useAsyncStorage) {
              await AsyncStorage.setItem(this.keyStorageKey, this.encryptionKey);
            }
          }
        } catch (error) {
          console.log('Failed to load from secure storage');
        }
      }

      // If still no key, create a new one
      if (!this.encryptionKey) {
        console.log('Creating new key');
        this.encryptionKey = CryptoJS.lib.WordArray.random(32).toString();
        
        // Store in both places for redundancy
        try {
          await secureStorage.setItem(this.keyStorageKey, this.encryptionKey);
          if (useAsyncStorage) {
            await AsyncStorage.setItem(this.keyStorageKey, this.encryptionKey);
          }
        } catch (error) {
          console.log('Failed to save new key:', error);
        }
      }
      
      this.initialized = true;
      console.log('Encryption service ready');
    } catch (error) {
      console.log('Encryption init error:', error);
      logError('EncryptionService.initialize [CONSOLE_ONLY]', error);
      
      // Last resort - use env key
      if (!this.encryptionKey) {
        console.log('Using env key as last resort');
        this.encryptionKey = DEVELOPMENT_ENCRYPTION_KEY;
        this.initialized = true;
      }
    }
  }

  // Encrypts a string - returns null if it fails
  async encrypt(data: string): Promise<string | null> {
    try {
      // No need to encrypt empty data
      if (!data) {
        return data;
      }
      
      await this.ensureInitialized();
      
      if (!this.encryptionKey) {
        throw new Error('No encryption key available');
      }
      
      return CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
    } catch (error) {
      console.log('Encryption failed:', error);
      logError('EncryptionService.encrypt [CONSOLE_ONLY]', error);
      return null;
    }
  }

  // Decrypts a string - returns null if it fails
  async decrypt(encryptedData: string): Promise<string | null> {
    try {
      if (!encryptedData) {
        return encryptedData;
      }
      
      await this.ensureInitialized();
      
      if (!this.encryptionKey) {
        throw new Error('No encryption key available');
      }
      
      // Just use the current key
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      return decrypted || null;
    } catch (error) {
      console.log('Decryption failed:', error);
      logError('EncryptionService.decrypt [CONSOLE_ONLY]', error);
      return null;
    }
  }
  
  // For debugging - shows part of the key
  getKeyPreview(): string {
    if (!this.encryptionKey) {
      return 'Not initialized';
    }
    return `${this.encryptionKey.substring(0, 5)}...`;
  }
}

export const encryptionService = new EncryptionService();
