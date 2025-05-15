import axios from 'axios';
import { TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET, TRUELAYER_REDIRECT_URI, API_URL } from '@env';
import { logError } from '../utils/errorHandling';
import { secureStorage } from './secureStorage';
import { firebaseService } from './firebaseService';
import { encryptionService } from './encryptionService';

// Define types
export interface BankAccount {
  account_id: string;
  institution_id: string;
  institution_name: string;
  account_number?: string;
  sort_code?: string;
  display_name: string;
}

export interface Balance {
  current: number;
  available?: number;
  currency: string;
  last_updated: string;
}

export interface Transaction {
  id: string;
  timestamp: string;
  description: string;
  amount: number;
  currency: string;
  transaction_type: string;
  transaction_category?: string;
  merchant_name?: string;
}

export interface PaymentStatus {
  status: 'AuthorizationRequired' | 'Initiated' | 'Settled' | 'Failed';
  payment_id: string;
}

export class TrueLayerService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private dataApiUrl = 'https://api.truelayer-sandbox.com';
  private authApiUrl = 'https://auth.truelayer-sandbox.com';
  private connectTokenUrl = 'https://auth.truelayer-sandbox.com/connect/token';
  private requestTimeout = 30000; // 30 seconds

  constructor() {
    this.loadTokens();
  }

  async initSDK(): Promise<void> {
    try {
      await this.loadTokens();
      console.log('TrueLayer service initialized');
    } catch (error) {
      logError('TrueLayerService.initSDK', error);
      throw error;
    }
  }

  private async secureFetch(url: string, options: any = {}): Promise<any> {
    try {
      const config = {
        ...options,
        url,
        timeout: this.requestTimeout,
        headers: {
          ...options.headers,
        },
      };

      // Handle different body content types
      if (options.body) {
        if (options.headers && options.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
          const formData = new URLSearchParams();
          Object.entries(options.body).forEach(([key, value]) => {
            formData.append(key, String(value));
          });
          config.data = formData.toString();
        } else if (typeof options.body === 'object') {
          config.data = JSON.stringify(options.body);
          config.headers = {
            ...config.headers,
            'Content-Type': 'application/json',
          };
        } else {
          config.data = options.body;
        }
      }

      // For debugging
      console.log(`Making request to ${url}`, {
        method: options.method,
        headers: config.headers,
      });

      const response = await axios(config);

      return response.data;
    } catch (error: any) {
      const errorDetails = {
        url,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      };

      logError('TrueLayerService.secureFetch', error, errorDetails);

      // Rethrow with more context
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  private async loadTokens(): Promise<void> {
    try {
      const accessToken = await secureStorage.getItem('tl_access_token');
      const refreshToken = await secureStorage.getItem('tl_refresh_token');

      if (accessToken) console.log('Access token loaded from storage');
      if (refreshToken) console.log('Refresh token loaded from storage');

      this.accessToken = accessToken;
      this.refreshToken = refreshToken;

      // If we have an access token but no refresh token, this is an issue
      // that will prevent token refresh, so warn about it
      if (accessToken && !refreshToken) {
        console.warn('WARNING: Access token found but no refresh token. Token renewal will not work.');
      }
    } catch (error) {
      logError('TrueLayerService.loadTokens', error);
      throw error;
    }
  }

  async getAccessToken(): Promise<string | null> {
    try {
      // If we don't have an access token but have a refresh token, try to refresh
      if (!this.accessToken && this.refreshToken) {
        try {
          await this.refreshAccessToken();
        } catch (error) {
          console.error('Failed to refresh access token:', error);
          return null;
        }
      }

      if (!this.accessToken) {
        // We don't have a token and couldn't refresh
        return null;
      }

      // Check if token is expired by decoding it (optional JWT check)
      const tokenParts = this.accessToken.split('.');
      if (tokenParts.length === 3) {
        try {
          const payload = JSON.parse(atob(tokenParts[1]));
          const expiry = payload.exp * 1000; // Convert to milliseconds

          if (expiry < Date.now()) {
            console.log('Token is expired, attempting refresh');
            if (this.refreshToken) {
              await this.refreshAccessToken();
            } else {
              console.error('Cannot refresh expired token - no refresh token available');
              return null;
            }
          }
        } catch (e) {
          console.warn('Could not decode token to check expiry');
        }
      }

      return this.accessToken;
    } catch (error) {
      logError('TrueLayerService.getAccessToken', error);
      return null;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      if (!this.refreshToken) {
        console.warn('Cannot refresh token - no refresh token available');
        this.accessToken = null;
        await secureStorage.removeItem('tl_access_token');
        throw new Error('No refresh token available. Please reconnect the bank.');
      }

      console.log('Attempting to refresh access token');

      const requestBody = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: TRUELAYER_CLIENT_ID,
        client_secret: TRUELAYER_CLIENT_SECRET,
        refresh_token: this.refreshToken,
      }).toString();

      // Use axios directly for better control over content type
      const response = await axios({
        method: 'POST',
        url: this.connectTokenUrl,
        data: requestBody,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: this.requestTimeout,
      });

      // Log the response for debugging
      console.log('Refresh token response:', JSON.stringify({
        status: response.status,
        data: response.data ? Object.keys(response.data) : 'No data',
      }));

      if (!response.data) {
        throw new Error('Refresh token response is empty');
      }

      // Access token is required for refresh
      if (!response.data.access_token) {
        throw new Error('Refresh token response missing access_token');
      }

      this.accessToken = response.data.access_token;
      console.log('Access token refreshed successfully');

      // Save the new access token
      if (this.accessToken) {
        await secureStorage.setItem('tl_access_token', this.accessToken);
      }

      // Some OAuth providers don't return a new refresh token every time,
      // but if they do, we should save it
      if (response.data.refresh_token) {
        this.refreshToken = response.data.refresh_token;
        console.log('Refresh token also updated');
        if (this.refreshToken) {
          await secureStorage.setItem('tl_refresh_token', this.refreshToken);
        }
      }
    } catch (error) {
      logError('TrueLayerService.refreshAccessToken', error);

      // Clear the tokens if refresh failed
      this.accessToken = null;
      this.refreshToken = null;
      await secureStorage.removeItem('tl_access_token');
      await secureStorage.removeItem('tl_refresh_token');

      throw new Error('Failed to refresh access token. Please reconnect the bank.');
    }
  }

  private async saveTokensToFirebase(userId: string, institutionId: string, institutionName: string): Promise<void> {
    try {
      // Only require access token to save to Firebase (refresh is optional)
      if (!this.accessToken) {
        throw new Error('No access token available to save.');
      }

      try {
        // First try to save the bank connection normally
        await firebaseService.saveBankConnection(userId, {
          institutionId,
          institutionName,
          accessToken: this.accessToken,
          refreshToken: this.refreshToken || '',
        });

        console.log('Tokens saved to Firebase successfully');
      } catch (error) {
        // If it's an encryption error, try to ensure encryption service is initialized
        if (error instanceof Error && error.message.includes('encrypt')) {
          console.warn('Encryption error detected when saving to Firebase, attempting to reinitialize encryption service');

          // Try to explicitly initialize encryption service
          try {
            await encryptionService.ensureInitialized();

            // Try again with reinitialized encryption service
            await firebaseService.saveBankConnection(userId, {
              institutionId,
              institutionName,
              accessToken: this.accessToken,
              refreshToken: this.refreshToken || '',
            });

            console.log('Tokens saved to Firebase successfully after reinitializing encryption');
          } catch (secondError) {
            console.warn('Still unable to save tokens to Firebase after reinitializing encryption:', secondError);
            // Don't throw, just continue with the flow
          }
        } else {
          // For other types of errors, just log and continue
          console.warn('Non-encryption error when saving to Firebase:', error);
        }
      }
    } catch (error) {
      // Log but don't throw the error to allow authentication flow to continue
      console.warn('Could not save tokens to Firebase. This may affect syncing across devices:', error);
    }
  }

  async handleRedirectUri(uri: string): Promise<string> {
    try {
      console.log('Handling redirect URI:', uri);

      // Extract the query string from the URI
      const queryString = uri.split('?')[1];
      if (!queryString) {
        throw new Error('No query string found in redirect URI');
      }

      // Parse the query string manually to ensure it works correctly
      const params = queryString.split('&').reduce((result: Record<string, string>, param) => {
        const [key, value] = param.split('=');
        if (key && value) {
          result[key] = decodeURIComponent(value);
        }
        return result;
      }, {});

      const code = params['code'];
      const error = params['error'];
      const errorDescription = params['error_description'];

      if (error) {
        throw new Error(`Auth error: ${error} ${errorDescription || ''}`);
      }

      if (!code) {
        throw new Error('No authorization code found in redirect URI');
      }

      console.log('Authorization code extracted successfully in', Date.now());
      return code;
    } catch (error) {
      logError('TrueLayerService.handleRedirectUri', error);
      throw error;
    }
  }

  async exchangeCodeForToken(code: string, userId: string, institutionId: string, institutionName: string): Promise<void> {
    try {
      console.log('Exchanging code for token with code:', code.substring(0, 10) + '...');

      const requestBody = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: TRUELAYER_CLIENT_ID,
        client_secret: TRUELAYER_CLIENT_SECRET,
        redirect_uri: TRUELAYER_REDIRECT_URI,
        code,
      }).toString();

      console.log('Using redirect URI:', TRUELAYER_REDIRECT_URI);

      // Make the request with increased timeout
      try {
        const response = await axios({
          method: 'POST',
          url: this.connectTokenUrl,
          data: requestBody,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 60000,
        });

        // Log the response for debugging
        console.log('Token exchange response status:', response.status);
        console.log('Token exchange response keys:', response.data ? Object.keys(response.data) : 'No data');

        // Check for any response data
        if (!response.data) {
          throw new Error('Token exchange returned empty response');
        }

        // Check for access token - this is required
        if (!response.data.access_token) {
          throw new Error('Token exchange response missing access_token');
        }

        // Store the access token
        this.accessToken = response.data.access_token;
        console.log('Access token received successfully');

        // Store it in secure storage - with null check
        if (this.accessToken) {
          await secureStorage.setItem('tl_access_token', this.accessToken);
        }

        // Refresh token is optional but preferred
        if (response.data.refresh_token) {
          this.refreshToken = response.data.refresh_token;
          console.log('Refresh token received successfully');

          // Add null check before storing
          if (this.refreshToken) {
            await secureStorage.setItem('tl_refresh_token', this.refreshToken);
          }
        } else {
          console.warn('No refresh token received from TrueLayer. Token renewal will be limited.');
          this.refreshToken = null;
        }

        // Now save to Firebase with retries
        let retries = 3;
        let success = false;

        while (retries > 0 && !success) {
          try {
            await this.saveTokensToFirebase(userId, institutionId, institutionName);
            console.log('Tokens saved to Firebase');
            success = true;
          } catch (error) {
            console.error(`Failed to save tokens to Firebase (attempt ${4-retries}/3):`, error);
            retries--;
            if (retries > 0) {
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }

        if (!success) {
          console.warn('Could not save tokens to Firebase after multiple attempts');
        }

        console.log('Token exchange and storage completed');
      } catch (error: any) {
        // Handle Axios errors
        console.error('Token exchange request failed:', error.message);

        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', JSON.stringify(error.response.data));
        }

        throw new Error(`Token exchange failed: ${error.message}`);
      }
    } catch (error) {
      logError('TrueLayerService.exchangeCodeForToken', error);
      throw error;
    }
  }

  async authenticatedFetch(url: string, options: any = {}): Promise<any> {
    try {
      // Make sure we have a token
      const token = await this.getAccessToken();
      if (!token) {
        throw new Error('No access token available. Please connect a bank first.');
      }

      // Add token to headers
      const authOptions = {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      };

      try {
        // Attempt the request
        return await this.secureFetch(url, authOptions);
      } catch (error: any) {
        // If token expired and we have a refresh token, try refreshing and retrying
        if (error.response?.status === 401 && this.refreshToken) {
          console.log('Token expired, refreshing and retrying request');
          await this.refreshAccessToken();

          // Update auth header with new token
          if (this.accessToken) {
            authOptions.headers.Authorization = `Bearer ${this.accessToken}`;

            // Retry the request
            return await this.secureFetch(url, authOptions);
          }
        }
        throw error;
      }
    } catch (error) {
      logError(`TrueLayerService.authenticatedFetch to ${url}`, error);
      throw error;
    }
  }

  async getAccounts(): Promise<BankAccount[]> {
    try {
      console.log('Fetching accounts');

      const response = await this.authenticatedFetch(`${this.dataApiUrl}/data/v1/accounts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.results || !Array.isArray(response.results)) {
        throw new Error('Invalid account data format received');
      }

      const accounts: BankAccount[] = response.results.map((account: any) => ({
        account_id: account.account_id,
        institution_id: account.provider?.provider_id || 'unknown',
        institution_name: account.provider?.display_name || 'Unknown Bank',
        account_number: account.account_number?.number,
        sort_code: account.account_number?.sort_code,
        display_name: account.display_name || `Account ${account.account_id.substring(0, 6)}`,
      }));

      console.log(`Found ${accounts.length} accounts`);
      return accounts;
    } catch (error) {
      logError('TrueLayerService.getAccounts', error);

      // If no accounts or error, try using mock data in development
      if (__DEV__) {
        console.log('Using mock accounts as fallback');
        return this.getMockAccounts();
      }

      throw error;
    }
  }

  async getBalances(accountIds: string[]): Promise<{ [accountId: string]: Balance }> {
    try {
      const token = await this.getAccessToken();
      if (!token) {
        throw new Error('No access token available. Please connect a bank first.');
      }

      console.log(`Fetching balances for ${accountIds.length} accounts`);

      const balances: { [accountId: string]: Balance } = {};

      for (const accountId of accountIds) {
        try {
          const response = await this.secureFetch(`${this.dataApiUrl}/data/v1/accounts/${accountId}/balance`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.results || !Array.isArray(response.results) || response.results.length === 0) {
            console.warn(`Invalid balance data format for account ${accountId}`);
            continue;
          }

          balances[accountId] = {
            current: response.results[0].current,
            available: response.results[0].available,
            currency: response.results[0].currency,
            last_updated: new Date().toISOString(),
          };

          console.log(`Retrieved balance for account ${accountId}: ${balances[accountId].available} ${balances[accountId].currency}`);
        } catch (error: any) {
          console.warn(`Error fetching balance for account ${accountId}:`, error);
          // Continue with other accounts even if one fails
        }
      }

      return balances;
    } catch (error) {
      logError('TrueLayerService.getBalances', error);
      throw error;
    }
  }

  async getTransactions(accountId: string, fromDate: string, toDate: string): Promise<Transaction[]> {
    try {
      const response = await this.authenticatedFetch(
        `${this.dataApiUrl}/data/v1/accounts/${accountId}/transactions?from=${fromDate}&to=${toDate}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.results || !Array.isArray(response.results)) {
        throw new Error('Invalid transaction data format received');
      }

      return response.results.map((tx: any) => ({
        id: tx.transaction_id,
        timestamp: tx.timestamp,
        description: tx.description || '',
        amount: tx.amount,
        currency: tx.currency,
        transaction_type: tx.transaction_type || 'UNKNOWN',
        transaction_category: tx.transaction_category || 'UNKNOWN',
        merchant_name: tx.merchant_name,
      }));
    } catch (error) {
      logError('TrueLayerService.getTransactions', error);
      throw error;
    }
  }

  async initiatePayment(paymentRequest: any): Promise<{ paymentId: string; resourceToken: string }> {
    try {
      // Mock implementation for sandbox
      const paymentId = `payment-${Date.now()}`;
      const resourceToken = `token-${Date.now()}`;

      // In a real implementation, we would call the TrueLayer payments API

      return { paymentId, resourceToken };
    } catch (error) {
      logError('TrueLayerService.initiatePayment', error);
      throw error;
    }
  }

  async getPaymentStatus(paymentId: string, resourceToken: string): Promise<PaymentStatus> {
    try {
      // Mock implementation for sandbox
      // In a real implementation, we would call the TrueLayer payments API

      const statuses: ('AuthorizationRequired' | 'Initiated' | 'Settled' | 'Failed')[] = [
        'AuthorizationRequired', 'Initiated', 'Settled', 'Failed',
      ];

      const status = statuses[Math.floor(Math.random() * statuses.length)];

      return {
        status,
        payment_id: paymentId,
      };
    } catch (error) {
      logError('TrueLayerService.getPaymentStatus', error);
      throw error;
    }
  }

  async revokeAccess(bankId: string): Promise<void> {
    try {
      // This would call the TrueLayer API to revoke access in a real implementation
      console.log(`Access revoked for bank: ${bankId}`);
    } catch (error) {
      logError('TrueLayerService.revokeAccess', error);
      throw error;
    }
  }

  // Mock accounts for development when real API fails
  async getMockAccounts(): Promise<BankAccount[]> {
    console.log('Using mock accounts data for development');
    return [
      {
        account_id: 'mock-acc-123',
        institution_id: 'mock',
        institution_name: 'Mock Bank',
        account_number: '12345678',
        sort_code: '04-00-04',
        display_name: 'Current Account',
      },
      {
        account_id: 'mock-acc-456',
        institution_id: 'mock',
        institution_name: 'Mock Bank',
        account_number: '87654321',
        sort_code: '04-00-04',
        display_name: 'Savings Account',
      },
    ];
  }

  // Mock balances for development when real API fails
  async getMockBalances(accountIds: string[]): Promise<{ [accountId: string]: Balance }> {
    console.log('Using mock balance data for development');
    const balances: { [accountId: string]: Balance } = {};

    accountIds.forEach(accountId => {
      balances[accountId] = {
        current: 1250.50,
        available: 1200.00,
        currency: 'GBP',
        last_updated: new Date().toISOString(),
      };
    });

    return balances;
  }

  async startBankAuth(): Promise<{ success: boolean; redirectUrl?: string }> {
    try {
      // Format the query parameters properly
      const queryParams = new URLSearchParams({
        response_type: 'code',
        client_id: TRUELAYER_CLIENT_ID,
        redirect_uri: TRUELAYER_REDIRECT_URI,
        scope: 'accounts balance transactions',
        provider_id: 'mock',
      }).toString();

      const authLink = `${this.authApiUrl}/?${queryParams}`;

      console.log('Bank auth URL:', authLink);

      return {
        success: true,
        redirectUrl: authLink,
      };
    } catch (error) {
      logError('TrueLayerService.startBankAuth', error);
      return { success: false };
    }
  }
}

export const trueLayerService = new TrueLayerService();