import { trueLayerService, BankAccount, Balance, Transaction } from './trueLayerService';
import { firebaseService } from './firebaseService';
import { cacheService } from './cacheService';
import { logError } from '../utils/errorHandling';
import moment from 'moment';

interface SyncStatus {
  lastSync: string | null;
  inProgress: boolean;
  error: string | null;
}

export class SyncService {
  private syncStatus: SyncStatus = {
    lastSync: null,
    inProgress: false,
    error: null,
  };

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Sync all accounts data
   */
  async syncAccounts(userId: string): Promise<void> {
    try {
      if (this.syncStatus.inProgress) {
        return;
      }

      this.syncStatus = {
        ...this.syncStatus,
        inProgress: true,
        error: null,
      };

      // Get accounts from TrueLayer
      const accounts = await trueLayerService.getAccounts();

      // Get balances for all accounts
      const accountIds = accounts.map((a) => a.account_id);
      const balances = await trueLayerService.getBalances(accountIds);

      // Combine account data with balances
      const accountsWithBalance = accounts.map((account) => ({
        ...account,
        balance: balances[account.account_id] || null,
      }));

      // Cache the results
      await cacheService.setCache('accounts', accountsWithBalance, { expiryMinutes: 5 });

      // Store in Firebase for each bank
      const bankAccounts: { [key: string]: BankAccount[] } = {};
      accounts.forEach((account) => {
        const bankId = account.institution_id;
        if (!bankAccounts[bankId]) {
          bankAccounts[bankId] = [];
        }
        bankAccounts[bankId].push(account);
      });

      // Save each bank's data to Firebase
      for (const [bankId, bankAccountsList] of Object.entries(bankAccounts)) {
        await firebaseService.saveBankConnection(userId, {
          institutionId: bankId,
          institutionName: bankAccountsList[0].institution_name,
          accessToken: '', // Placeholder; should come from TrueLayer auth
          refreshToken: '', // Placeholder; should come from TrueLayer auth
        });
      }

      this.syncStatus = {
        lastSync: new Date().toISOString(),
        inProgress: false,
        error: null,
      };

      // Save sync status to AsyncStorage
      await cacheService.setCache('syncStatus', this.syncStatus);
    } catch (error) {
      logError('SyncService.syncAccounts', error);

      // Update sync status with error
      this.syncStatus = {
        ...this.syncStatus,
        inProgress: false,
        error: error instanceof Error ? error.message : 'Failed to sync accounts',
      };

      // Save error status
      await cacheService.setCache('syncStatus', this.syncStatus);
      throw error;
    }
  }

  /**
   * Sync transactions for a specific account
   */
  async syncTransactions(userId: string, accountId: string, days: number = 90): Promise<Transaction[]> {
    try {
      // Get transactions from last X days
      const toDate = moment().format('YYYY-MM-DD');
      const fromDate = moment().subtract(days, 'days').format('YYYY-MM-DD');

      const transactions = await trueLayerService.getTransactions(accountId, fromDate, toDate);

      // Cache the results
      await cacheService.setCache(`transactions_${accountId}`, transactions, { expiryMinutes: 15 });

      // Save transaction metadata to Firebase
      await firebaseService.saveAccountSettings(userId, {
        last_transaction_sync: new Date().toISOString(),
        transaction_count: transactions.length,
        accountId: accountId, // Include accountId in the settings object
      });

      return transactions;
    } catch (error) {
      logError('SyncService.syncTransactions', error);
      throw error;
    }
  }

  /**
   * Get accounts with balance from cache or API
   */
  async getAccounts(): Promise<(BankAccount & { balance: Balance | null })[]> {
    try {
      // Try to get from cache first
      const cachedAccounts = await cacheService.getCache<(BankAccount & { balance: Balance | null })[]>('accounts', {
        expiryMinutes: 5,
      });

      if (cachedAccounts) {
        return cachedAccounts;
      }

      // If not in cache, get from API
      const accounts = await trueLayerService.getAccounts();

      // Get balances for all accounts
      const accountIds = accounts.map((a) => a.account_id);
      const balances = await trueLayerService.getBalances(accountIds);

      // Combine account data with balances
      const accountsWithBalance = accounts.map((account) => ({
        ...account,
        balance: balances[account.account_id] || null,
      }));

      // Cache the results
      await cacheService.setCache('accounts', accountsWithBalance, { expiryMinutes: 5 });

      return accountsWithBalance;
    } catch (error) {
      logError('SyncService.getAccounts', error);
      throw error;
    }
  }

  /**
   * Get transactions for a specific account
   */
  async getTransactions(accountId: string, forceRefresh: boolean = false): Promise<Transaction[]> {
    try {
      if (!forceRefresh) {
        // Try to get from cache first
        const cachedTransactions = await cacheService.getCache<Transaction[]>(`transactions_${accountId}`, {
          expiryMinutes: 15,
        });

        if (cachedTransactions) {
          return cachedTransactions;
        }
      }

      // If not in cache or force refresh, get from API
      const toDate = moment().format('YYYY-MM-DD');
      const fromDate = moment().subtract(90, 'days').format('YYYY-MM-DD');

      const transactions = await trueLayerService.getTransactions(accountId, fromDate, toDate);

      // Cache the results
      await cacheService.setCache(`transactions_${accountId}`, transactions, { expiryMinutes: 15 });

      return transactions;
    } catch (error) {
      logError('SyncService.getTransactions', error);
      throw error;
    }
  }

  /**
   * Disconnect a bank and remove its data
   */
  public async disconnectBank(bankId: string): Promise<void> {
    try {
      // Revoke access via TrueLayer
      await trueLayerService.revokeAccess(bankId);

      // Remove bank data from cache
      const cachedAccounts = await cacheService.getCache<(BankAccount & { balance: Balance | null })[]>('accounts', {
        expiryMinutes: 5,
      });

      if (cachedAccounts) {
        const updatedAccounts = cachedAccounts.filter(account => account.institution_id !== bankId);
        await cacheService.setCache('accounts', updatedAccounts, { expiryMinutes: 5 });
      }

      // Remove transactions for accounts belonging to this bank
      const accountIds = cachedAccounts
        ?.filter(account => account.institution_id === bankId)
        .map(account => account.account_id) || [];

      for (const accountId of accountIds) {
        await cacheService.clearCache(`transactions_${accountId}`);
      }

      // Update sync status
      this.syncStatus = {
        ...this.syncStatus,
        lastSync: new Date().toISOString(),
      };
      await cacheService.setCache('syncStatus', this.syncStatus);
    } catch (error) {
      logError('SyncService.disconnectBank', error);
      throw error;
    }
  }

  /**
   * Init sync service
   */
  async init(): Promise<void> {
    try {
      const savedStatus = await cacheService.getCache<SyncStatus>('syncStatus');
      if (savedStatus) {
        this.syncStatus = savedStatus;
      }
    } catch (error) {
      logError('SyncService.init', error);
    }
  }
}

export const syncService = new SyncService();
// Initialize on import
syncService.init();