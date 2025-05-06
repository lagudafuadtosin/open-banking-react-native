import axios from 'axios';
import { TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET, TRUELAYER_REDIRECT_URI, API_URL } from '@env';
import { logError } from '../utils/errorHandling';
import { secureStorage } from './secureStorage';

// Define types (unchanged)
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
  private connectTokenUrl = 'https://auth.truelayer-sandbox.com/connect/token';
  private requestTimeout = 10000; // 10 seconds

  constructor() {
    this.loadTokens();
  }

  // This method exists for backward compatibility with existing code
  // but doesn't use the actual SDK anymore
  async initSDK(): Promise<void> {
    try {
      // Just load tokens to maintain compatibility with existing code flows
      await this.loadTokens();
      console.log('TrueLayer service initialized (no SDK)');
    } catch (error) {
      logError('TrueLayerService.initSDK', error);
      // Don't throw here - just log and continue since we're not actually using an SDK
    }
  }

  private async secureFetch(url: string, options: any = {}): Promise<any> {
    try {
      const config = {
        ...options,
        url,
        timeout: this.requestTimeout,
        headers: options.headers || {},
      };

      if (options.body instanceof URLSearchParams) {
        config.data = options.body.toString();
        config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else if (options.body) {
        config.data = options.body;
        config.headers['Content-Type'] = 'application/json';
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      logError('TrueLayerService.secureFetch', error);
      throw error;
    }
  }

  private async loadTokens(): Promise<void> {
    try {
      const accessToken = await secureStorage.getItem('tl_access_token');
      const refreshToken = await secureStorage.getItem('tl_refresh_token');
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
    } catch (error) {
      logError('TrueLayerService.loadTokens', error);
    }
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      if (!this.refreshToken) {
        throw new Error('No refresh token available. Please reconnect the bank.');
      }

      const response = await this.secureFetch(this.connectTokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: TRUELAYER_CLIENT_ID,
          client_secret: TRUELAYER_CLIENT_SECRET,
          refresh_token: this.refreshToken,
        }),
      });

      this.accessToken = response.access_token;
      this.refreshToken = response.refresh_token;

      if (this.accessToken) {
        await secureStorage.setItem('tl_access_token', this.accessToken);
      }
      if (this.refreshToken) {
        await secureStorage.setItem('tl_refresh_token', this.refreshToken);
      }
    } catch (error) {
      logError('TrueLayerService.refreshAccessToken', error);
      this.accessToken = null;
      this.refreshToken = null;
      await secureStorage.removeItem('tl_access_token');
      await secureStorage.removeItem('tl_refresh_token');
      throw new Error('Failed to refresh access token. Please reconnect the bank.');
    }
  }

  async handleRedirectUri(uri: string): Promise<string> {
    try {
      const url = new URL(uri);
      const code = url.searchParams.get('code');
      if (!code) {
        throw new Error('No authorization code found in redirect URI');
      }
      return code;
    } catch (error) {
      logError('TrueLayerService.handleRedirectUri', error);
      throw error;
    }
  }

  async exchangeCodeForToken(code: string): Promise<void> {
    try {
      const response = await this.secureFetch(this.connectTokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: TRUELAYER_CLIENT_ID,
          client_secret: TRUELAYER_CLIENT_SECRET,
          redirect_uri: TRUELAYER_REDIRECT_URI,
          code,
        }),
      });

      this.accessToken = response.access_token;
      this.refreshToken = response.refresh_token;

      if (this.accessToken) {
        await secureStorage.setItem('tl_access_token', this.accessToken);
      }
      if (this.refreshToken) {
        await secureStorage.setItem('tl_refresh_token', this.refreshToken);
      }
    } catch (error) {
      logError('TrueLayerService.exchangeCodeForToken', error);
      throw error;
    }
  }

  async getAccounts(): Promise<BankAccount[]> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available. Please connect a bank first.');
      }

      try {
        const response = await this.secureFetch(`${this.dataApiUrl}/data/v1/accounts`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        const accounts: BankAccount[] = response.results.map((account: any) => ({
          account_id: account.account_id,
          institution_id: account.provider.provider_id,
          institution_name: account.provider.display_name,
          account_number: account.account_number?.number,
          sort_code: account.account_number?.sort_code,
          display_name: account.display_name,
        }));

        return accounts;
      } catch (error: any) {
        if (error.status === 401) {
          await this.refreshAccessToken();
          return this.getAccounts();
        }
        throw error;
      }
    } catch (error) {
      logError('TrueLayerService.getAccounts', error);
      throw error;
    }
  }

  async getBalances(accountIds: string[]): Promise<{ [accountId: string]: Balance }> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available. Please connect a bank first.');
      }

      const balances: { [accountId: string]: Balance } = {};

      for (const accountId of accountIds) {
        try {
          const response = await this.secureFetch(`${this.dataApiUrl}/data/v1/accounts/${accountId}/balance`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          });

          balances[accountId] = {
            current: response.results[0].current,
            available: response.results[0].available,
            currency: response.results[0].currency,
            last_updated: new Date().toISOString(),
          };
        } catch (error: any) {
          if (error.status === 401) {
            await this.refreshAccessToken();
            return this.getBalances(accountIds);
          }
          throw error;
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
      if (!this.accessToken) {
        throw new Error('No access token available. Please connect a bank first.');
      }

      try {
        const response = await this.secureFetch(
          `${this.dataApiUrl}/data/v1/accounts/${accountId}/transactions?from=${fromDate}&to=${toDate}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const transactions: Transaction[] = response.results.map((txn: any) => ({
          id: txn.transaction_id,
          timestamp: txn.timestamp,
          description: txn.description,
          amount: txn.amount,
          currency: txn.currency,
          transaction_type: txn.transaction_type,
          transaction_category: txn.transaction_category,
          merchant_name: txn.merchant_name,
        }));

        return transactions;
      } catch (error: any) {
        if (error.status === 401) {
          await this.refreshAccessToken();
          return this.getTransactions(accountId, fromDate, toDate);
        }
        throw error;
      }
    } catch (error) {
      logError('TrueLayerService.getTransactions', error);
      throw error;
    }
  }

  async revokeAccess(bankId: string): Promise<void> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available to revoke.');
      }

      await this.secureFetch(`${this.dataApiUrl}/data/v1/access`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: {
          provider_id: bankId,
        },
      });

      this.accessToken = null;
      this.refreshToken = null;
      await secureStorage.removeItem('tl_access_token');
      await secureStorage.removeItem('tl_refresh_token');
    } catch (error) {
      logError('TrueLayerService.revokeAccess', error);
      throw error;
    }
  }

  async getPaymentStatus(paymentId: string, resourceToken: string): Promise<PaymentStatus> {
    try {
      const response = await this.secureFetch(`${API_URL}/v3/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${resourceToken}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        status: response.status,
        payment_id: response.id,
      };
    } catch (error) {
      logError('TrueLayerService.getPaymentStatus', error);
      throw error;
    }
  }

  async initiatePayment(paymentRequest: {
    amount: number;
    currency: string;
    recipient: { name: string; account_number: string; sort_code: string };
    accountId: string;
  }): Promise<{ paymentId: string; resourceToken: string }> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available. Please connect a bank first.');
      }

      try {
        const response = await this.secureFetch(`${API_URL}/v3/payments`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `pay-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
          },
          body: {
            amount_in_minor: Math.round(paymentRequest.amount * 100),
            currency: paymentRequest.currency,
            payment_method: {
              type: 'bank_transfer',
              provider_selection: {
                type: 'user_selected',
                account_id: paymentRequest.accountId,
              },
              beneficiary: {
                type: 'external_account',
                account_holder_name: paymentRequest.recipient.name,
                account_identifier: {
                  type: 'sort_code_account_number',
                  sort_code: paymentRequest.recipient.sort_code,
                  account_number: paymentRequest.recipient.account_number,
                },
                reference: `Payment-${Date.now()}`,
              },
            },
            user: {
              name: 'App User',
              email: 'user@example.com',
              phone: '+441234567890',
            },
          },
        });

        return {
          paymentId: response.id,
          resourceToken: response.resource_token,
        };
      } catch (error: any) {
        if (error.status === 401) {
          await this.refreshAccessToken();
          return this.initiatePayment(paymentRequest);
        }
        throw error;
      }
    } catch (error) {
      logError('TrueLayerService.initiatePayment', error);
      throw error;
    }
  }

  async connectBank(): Promise<{ success: boolean; redirectUrl?: string }> {
    try {
      const response = await this.secureFetch(`${API_URL}/v3/payments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `conn-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
        },
        body: {
          amount_in_minor: 100,
          currency: 'GBP',
          payment_method: {
            type: 'bank_transfer',
            provider_selection: {
              type: 'user_selected',
              filter: {
                countries: ['GB'],
                release_channel: 'general_availability',
                customer_segments: ['retail'],
                providers: ['mock-payments-gb-redirect'],
              },
              scheme_selection: {
                type: 'instant_only',
                allow_remitter_fee: false,
              },
            },
            beneficiary: {
              type: 'external_account',
              account_holder_name: 'Sandbox Test Account',
              account_identifier: {
                type: 'sort_code_account_number',
                sort_code: '04-00-04',
                account_number: '12345678',
              },
              reference: 'Connection',
            },
          },
          user: {
            name: 'Sandbox User',
            email: 'sandbox.user@example.com',
            phone: '+44123456789',
          },
        },
      });

      return {
        success: true,
        redirectUrl: response.auth_url,
      };
    } catch (error) {
      logError('TrueLayerService.connectBank', error);
      return { success: false };
    }
  }
}

export const trueLayerService = new TrueLayerService();