import DeepLinking from 'react-native-deep-linking';
import { trueLayerService } from './trueLayerService';
import { firebaseService } from './firebaseService';
import { Alert } from 'react-native';

// Define interfaces for different types of deep link parameters
export interface DeepLinkQueryParams {
  [key: string]: string | undefined;
}

export interface TrueLayerCallbackParams extends DeepLinkQueryParams {
  code?: string;
  state?: string; // Often used in OAuth flows
}

export interface DeepLinkParams {
  query: DeepLinkQueryParams;
}

export interface TrueLayerCallbackDeepLinkParams {
  query: TrueLayerCallbackParams;
}

export const setupDeepLinking = () => {
  DeepLinking.addScheme('truelayerbankingapp://');
  DeepLinking.addRoute('/callback', async ({ query }: TrueLayerCallbackDeepLinkParams) => {
    try {
      const code = query.code;
      if (code) {
        console.log('Deep link received with code:', code);
        const userId = firebaseService.getCurrentUserId();
        if (!userId) {
          throw new Error('User not authenticated');
        }
        // Mock institution details for sandbox; in production, these should come from the auth response or user selection
        const institutionId = 'mock';
        const institutionName = 'Mock Bank';
        await trueLayerService.exchangeCodeForToken(code, userId, institutionId, institutionName);
        Alert.alert('Success', 'Bank connected successfully!');
      } else {
        throw new Error('No authorization code found in deep link');
      }
    } catch (error) {
      console.error('Deep link error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', 'Failed to connect bank: ' + errorMessage);
    }
  });
};