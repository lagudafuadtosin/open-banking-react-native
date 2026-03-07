import axios, { AxiosError } from 'axios';
import { TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET, TRUELAYER_REDIRECT_URI, API_URL, TRUELAYER_PRIVATE_KEY_ID, TRUELAYER_PRIVATE_KEY } from '@env';
import { logError, getErrorMessage  } from '../utils/errorHandling';
import { secureStorage } from './secureStorage';
import { firebaseService } from './firebaseService';
import { encryptionService } from './encryptionService';
import { decode as base64Decode } from 'base-64';
import { v4 as uuidv4 } from 'uuid';

// Basic types needed
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
  status: 'authorization_required' | 'authorizing' | 'authorized' | 'executed' | 'settled' | 'failed';
  payment_id: string;
}

interface PaymentProgress {
  paymentId: string;
  createdAt: number;
  currentStatus: 'AuthorizationRequired' | 'Initiated' | 'Settled' | 'Failed';
}


const userId = uuidv4();
const shortRef = `Pay-${userId.slice(0, 10)}`; // Shortened to ~13 chars (Pay- + first 10 of UUID)

export class TrueLayerService {
  private accessToken: string | null = null;
  private dataApiUrl = 'https://api.truelayer-sandbox.com';
  private authApiUrl = 'https://auth.truelayer-sandbox.com';
  private connectTokenUrl = 'https://auth.truelayer-sandbox.com/connect/token';
  private requestTimeout = 30000; // 30 seconds timeout for requests
  private paymentProgressMap: Map<string, PaymentProgress> = new Map();

  constructor() {
    this.loadTokens();
  }
  // start of generate signature
  // Moved everything here to server-side, deleted no point not working
  // end of generate signature

  // Initialize the service
  async initSDK(): Promise<void> {
    try {
      await this.loadTokens();
      console.log('TrueLayer service initialized');
    } catch (error) {
      logError('TrueLayerService.initSDK', error);
      throw error;
    }
  }

  // Helper for making secure API calls
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

      // Handle form data vs JSON body
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

      // Better error message
      if (error.response) {
        throw new Error(`API Error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  // Load tokens from storage
  private async loadTokens(): Promise<void> {
    try {
      const accessToken = await secureStorage.getItem('tl_access_token');

      if (accessToken) console.log('Access token loaded from storage');

      this.accessToken = accessToken;
    } catch (error) {
      logError('TrueLayerService.loadTokens', error);
      throw error;
    }
  }

  // Get a valid access token
  async getAccessToken(): Promise<string | null> {
    try {
    
      if (!this.accessToken) {
        console.log('getAccessToken called - checking memory token:', !!this.accessToken);
        const storedToken = await secureStorage.getItem('tl_access_token');
        console.log('Retrieving from storage:', !!storedToken);
        this.accessToken = storedToken;
        return null;
      }

      // Check if token expired
      const tokenParts = this.accessToken.split('.');
      if (tokenParts.length === 3) {
        try {
          const payload = JSON.parse(base64Decode(tokenParts[1]));
          const expiry = payload.exp * 1000; // Milliseconds

         
        } catch (e) {
          logError('TrueLayerService.getAccessToken', 'Error parsing token payload', { error: e })
        }
      }

      return this.accessToken;
    } catch (error) {
      logError('TrueLayerService.getAccessToken', error);
      return null;
    }
  }

    // Clear all tokens and reset service state
  async clearTokens(): Promise<void> {
    try {
      console.log('Clearing TrueLayer tokens and service state');
      
      // Clear in-memory token
      this.accessToken = null;
      
      // Clear tokens from secure storage
      await secureStorage.removeItem('tl_access_token');
      await secureStorage.removeItem('tl_refresh_token');
      
      // Clear payment progress map
      this.paymentProgressMap.clear();
      
      console.log('TrueLayer tokens cleared successfully');
    } catch (error) {
      logError('TrueLayerService.clearTokens', error);
      throw error;
    }
  }
  // Store tokens in Firebase for cross-device access
  private async saveTokensToFirebase(userId: string, institutionId: string, institutionName: string): Promise<void> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available to save.');
      }

      try {
        await firebaseService.saveBankConnection(userId, {
          institutionId,
          institutionName,
          accessToken: this.accessToken,
          refreshToken: '',
        });

        console.log('Tokens saved to Firebase successfully');
      } catch (error) {
        // Try to fix encryption errors
        if (error instanceof Error && error.message.includes('encrypt')) {
          logError('TrueLayerService.saveTokensToFirebase', 'Encryption error detected when saving to Firebase, attempting to reinitialize encryption service');

          try {
            await encryptionService.ensureInitialized();

            await firebaseService.saveBankConnection(userId, {
              institutionId,
              institutionName,
              accessToken: this.accessToken,
              refreshToken: '',
            });

            console.log('Tokens saved to Firebase successfully after reinitializing encryption');
          } catch (secondError) {
            logError('TrueLayerService.saveTokensToFirebase', 'Still unable to save tokens to Firebase after reinitializing encryption', { error: secondError });
          }
        } else {
          logError('TrueLayerService.saveTokensToFirebase', new Error('Could not save tokens to Firebase. This may affect syncing across devices.'), error);
        }
      }
    } catch (error) {
      logError('TrueLayerService.saveTokensToFirebase', 'Could not save tokens to Firebase. This may affect syncing across devices', { error });
    }
  }

  // Extract the authorization code from callback URL
  async handleRedirectUri(uri: string): Promise<string> {
    try {
      console.log('Handling redirect URI:', uri);

      const queryString = uri.split('?')[1];
      if (!queryString) {
        throw new Error('No query string found in redirect URI');
      }

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

  // Exchange auth code for access token
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

      try {
        const response = await axios({
          method: 'POST',
          url: this.connectTokenUrl,
          data: requestBody,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 60000, // Longer timeout for token exchange
        });

        console.log('Token exchange response keys:', response.data ? Object.keys(response.data) : 'No data');

        if (!response.data) {
          throw new Error('Token exchange returned empty response');
        }

        if (!response.data.access_token) {
          throw new Error('Token exchange response missing access_token');
        }

        this.accessToken = response.data.access_token;
        console.log('Access token received successfully');
        

        if (this.accessToken) {
          await secureStorage.setItem('tl_access_token', this.accessToken);
          
           const storedToken = await secureStorage.getItem('tl_access_token');
          console.log('Verification - token stored successfully:', !!storedToken);
        }

        // Try to save to Firebase a few times
        let retries = 3;
        let success = false;

        while (retries > 0 && !success) {
          try {
            await this.saveTokensToFirebase(userId, institutionId, institutionName);
            console.log('Tokens saved to Firebase');
            success = true;
          } catch (error) {
            logError('TrueLayerService.exchangeCodeForToken', `Failed to save tokens to Firebase (attempt ${4-retries}/3)`, { error });
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }

        if (!success) {
          logError('TrueLayerService.exchangeCodeForToken', 'Could not save tokens to Firebase after multiple attempts');
        }

        console.log('Token exchange and storage completed');
      } catch (error: any) {
        logError('TrueLayerService.exchangeCodeForToken', 'Token exchange request failed', { 
          message: error.message,
          status: error.response?.status,
          data: error.response?.data 
        });

        throw new Error(`Token exchange failed: ${error.message}`);
      }
    } catch (error) {
      logError('TrueLayerService.exchangeCodeForToken', error);
      throw error;
    }
  }

  // Make authenticated API calls
  async authenticatedFetch(url: string, options: any = {}): Promise<any> {
    try {
      const token = await this.getAccessToken();
      if (!token) {
        throw new Error('No access token available. Please connect a bank first.');
      }

      const authOptions = {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      };

      return await this.secureFetch(url, authOptions);
    } catch (error) {
      logError(`TrueLayerService.authenticatedFetch to ${url}`, error);
      throw error;
    }
  }

  // Get all user accounts
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

      // Use mock data in dev mode
        console.log('Using mock accounts as fallback');
        return this.getMockAccounts();
  

      throw error;
    }
  }

  // Get balances for accounts
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
            logError('TrueLayerService.getBalances', `Invalid balance data format for account ${accountId}`);
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
          logError('TrueLayerService.getBalances', `Error fetching balance for account ${accountId}`, { accountId, error });
          // Keep going with other accounts
        }
      }

      return balances;
    } catch (error) {
      logError('TrueLayerService.getBalances', error);
      throw error;
    }
  }

  // Get transactions for a date range
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
  

  // Former Fake payment initiation for sandbox, changed to real see backup
async initiatePayment(paymentRequest: {
      amount: number;
      currency: string;
      accountIdentifier: string;
      recipient: {
        name: string;
        account_number: string;
        sort_code: string;
      };
      user: {
        id?: string;
        name: string;
        email: string;
      };
    }): Promise<{ paymentId: string; authUrl: string; status: string; resourceToken: string }> {
    try {
      const token = await this.getAccessToken();
      if (!token) {
        throw new Error('No access token available. Please connect a bank first.');
      }

          const paymentBody = {
          amount_in_minor: Math.round(paymentRequest.amount * 100),
          currency: paymentRequest.currency,
          payment_method: {
            type: 'bank_transfer',
            provider_selection: {
              type: 'user_selected',
              filter: {
                countries: ['GB'],
                release_channel: 'general_availability',
              },
              scheme_selection: {
                type: 'instant_only',
                allow_remitter_fee: false,
              },
            },
            beneficiary: {
              type: 'external_account',
              account_holder_name: paymentRequest.recipient.name,
              account_identifier: {
                type: 'sort_code_account_number',
                sort_code: paymentRequest.recipient.sort_code,
                account_number: paymentRequest.recipient.account_number,
              },
              reference: shortRef,
            },
          },
          user: {
            id: userId,
            name: paymentRequest.user.name,
            email: paymentRequest.user.email,
          },
          redirect: {
            return_uri: TRUELAYER_REDIRECT_URI, // Changed from redirect_uri
          },
        };

      const idempotencyKey = `payment-${Date.now()}-${userId.slice(0, 8)}`;
      const bodyString = JSON.stringify(paymentBody);

      const response = await axios.post('https://truelayer-server.onrender.com/api/truelayer-request', {
            url: `${this.dataApiUrl}/v3/payments`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: paymentBody,
        idempotencyKey,
      });

      console.log('Full payment response:', response.data); // Log full response for debugging

      if (!response.data.id) {
        throw new Error('Invalid payment initiation response: Missing payment ID');
      }

      let authUrl = response.data.authorization_uri;
      if (!authUrl) {
        console.log('Warning: authorization_uri missing in response. Check TrueLayer sandbox configuration.');
      }

      this.paymentProgressMap.set(response.data.id, {
        paymentId: response.data.id,
        createdAt: Date.now(),
        currentStatus: response.data.status || 'AuthorizationRequired',
      });

      return {
        paymentId: response.data.id,
        authUrl: authUrl || '',
        status: response.data.status || 'authorization_required',
        resourceToken: response.data.resource_token || '',
      };
    } catch (error) {
      logError('TrueLayerService.initiatePayment', error);
      throw error;
    }
  }

  // Same as above, the fake one removed
async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
  try {
    const response = await axios.post('https://truelayer-server.onrender.com/api/truelayer-request', {
      url: `${this.dataApiUrl}/v3/payments/${paymentId}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json'
      },
      idempotencyKey: `status-${paymentId}-${Date.now()}`
    });
    
    return {
      status: response.data.status,
      payment_id: response.data.id,
    };
  } catch (error) {
    logError('TrueLayerService.getPaymentStatus', error);
    throw error;
  }
}

  // Revoke access to bank (not needed at the moment, note called in syncService: Disconnectbank)
  async revokeAccess(bankId: string): Promise<void> {
    try {
      console.log(`Access revoked for bank: ${bankId}`);
    } catch (error) {
      logError('TrueLayerService.revokeAccess', error);
      throw error;
    }
  }

  // Mock accounts for testing, remove when real connection works (leave it for now, makes UI cool)
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

  // Mock balances for testing remove when real connection works
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

  // Start bank auth flow
  async startBankAuth(bankId: string = 'mock'): Promise<{ success: boolean; redirectUrl?: string }> {
    try {
      const queryParams = new URLSearchParams({
        response_type: 'code',
        client_id: TRUELAYER_CLIENT_ID,
        redirect_uri: TRUELAYER_REDIRECT_URI,
        scope: 'accounts balance transactions payments',
        provider_id: bankId,
      }).toString();

      const authLink = `${this.authApiUrl}/?${queryParams}`;

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