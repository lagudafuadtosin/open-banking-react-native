import { secureStorage } from './secureStorage';
import { logError } from '../utils/errorHandling';
import CryptoJS from 'react-native-crypto-js';

export class EncryptionService {
  private encryptionKey: string | null = null;
  private readonly keyStorageKey = 'encryptionKey';
  private initPromise: Promise<void>;

  constructor() {
    // Initialize immediately and store the promise for later use
    this.initPromise = this.initialize();
  }

  /**
   * Method to ensure initialization is complete
   * Other methods can await this before proceeding
   */
  async ensureInitialized(): Promise<void> {
    return this.initPromise;
  }

  /**
   * Initialize encryption service by loading or generating an encryption key
   * @private
   */
  private async initialize() {
    try {
      // Try to load the encryption key from secure storage
      this.encryptionKey = await secureStorage.getItem(this.keyStorageKey);

      if (!this.encryptionKey) {
        // Generate a new key if none exists (using a simple random string for demo purposes)
        this.encryptionKey = CryptoJS.lib.WordArray.random(32).toString();
        await secureStorage.setItem(this.keyStorageKey, this.encryptionKey);
      }
    } catch (error) {
      logError('EncryptionService.initialize', error);
      // Don't throw here, just log the error
      // This allows the service to be used even if initialization fails
    }
  }

  /**
   * Encrypt a string
   * @param data - String to encrypt
   * @returns Encrypted string or null if encryption fails
   */
  async encrypt(data: string): Promise<string | null> {
    try {
      // Ensure initialization is complete before proceeding
      await this.ensureInitialized();
      
      if (!this.encryptionKey) {
        throw new Error('Encryption key not initialized');
      }
      return CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
    } catch (error) {
      logError('EncryptionService.encrypt', error);
      return null;
    }
  }

  /**
   * Decrypt a string
   * @param encryptedData - Encrypted string
   * @returns Decrypted string or null if decryption fails
   */
  async decrypt(encryptedData: string): Promise<string | null> {
    try {
      // Ensure initialization is complete before proceeding
      await this.ensureInitialized();
      
      if (!this.encryptionKey) {
        throw new Error('Encryption key not initialized');
      }
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      return bytes.toString(CryptoJS.enc.Utf8) || null;
    } catch (error) {
      logError('EncryptionService.decrypt', error);
      return null;
    }
  }
}

export const encryptionService = new EncryptionService();