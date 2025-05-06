import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import { SecureStorage, secureStorage } from './secureStorage';
import { logError } from '../utils/errorHandling';

export class BiometricService {
  private rnBiometrics: ReactNativeBiometrics;
  private secureStorage: SecureStorage;
  
  constructor() {
    this.rnBiometrics = new ReactNativeBiometrics({
      allowDeviceCredentials: true,
    });
    this.secureStorage = secureStorage;
  }
  
  /**
   * Check if biometric authentication is available on the device
   */
  async isBiometricAvailable(): Promise<boolean> {
    try {
      const { available, biometryType } = await this.rnBiometrics.isSensorAvailable();
      return available && (
        biometryType === BiometryTypes.TouchID ||
        biometryType === BiometryTypes.FaceID ||
        biometryType === BiometryTypes.Biometrics
      );
    } catch (error) {
      logError('BiometricService.isBiometricAvailable', error);
      return false;
    }
  }
  
  /**
   * Create a biometric key pair for secure operations
   */
  async createKeys(): Promise<boolean> {
    try {
      // Delete existing keys if they exist to avoid conflicts
      const keysExist = await this.keysExist();
      if (keysExist) {
        await this.rnBiometrics.deleteKeys();
      }
      const { publicKey } = await this.rnBiometrics.createKeys();
      await this.secureStorage.setItem('biometricPublicKey', publicKey);
      return true;
    } catch (error) {
      logError('BiometricService.createKeys', error);
      return false;
    }
  }
  
  /**
   * Check if keys already exist
   */
  async keysExist(): Promise<boolean> {
    try {
      const { keysExist } = await this.rnBiometrics.biometricKeysExist();
      return keysExist;
    } catch (error) {
      logError('BiometricService.keysExist', error);
      return false;
    }
  }
  
  /**
   * Prompt user for biometric authentication
   */
  async authenticate(promptMessage: string = 'Confirm your identity'): Promise<boolean> {
    try {
      const { success } = await this.rnBiometrics.simplePrompt({
        promptMessage,
        cancelButtonText: 'Cancel',
      });
      return success;
    } catch (error) {
      logError('BiometricService.authenticate', error);
      return false;
    }
  }
  
  /**
   * Sign data with biometric authentication
   */
  async signWithBiometrics(payload: string): Promise<string | null> {
    try {
      const result = await this.rnBiometrics.createSignature({
        promptMessage: 'Sign with your biometric',
        payload,
      });
      return result.signature || null;
    } catch (error) {
      logError('BiometricService.signWithBiometrics', error);
      return null;
    }
  }
}

// Create and export a singleton instance
export const biometricService = new BiometricService();