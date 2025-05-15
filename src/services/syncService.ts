// src/services/syncService.ts

import { trueLayerService, BankAccount, Balance, Transaction } from './trueLayerService';
import { firebaseService } from './firebaseService';
import { cacheService } from './cacheService';
import { logError } from '../utils/errorHandling';
import moment from 'moment';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  async syncAccounts(userId: string): Promise<void> {
    try {
      if (this.syncStatus.inProgress) {
        console.log('Sync already in progress, skipping');
        return;
      }

      this.syncStatus = {
        ...this.syncStatus,
        inProgress: true,
        error: null,
      };
      
      console.log('Starting account sync');

      // Try to get accounts from TrueLayer
      let accounts: BankAccount[] = [];
      
      try {
        accounts = await trueLayerService.getAccounts();
      } catch (error) {
        console.error('Failed to get accounts:', error);
        // Rethrow the error - we want to fail if we can't get real accounts
        throw error;
      }

      const accountIds = accounts.map((a) => a.account_id);
      
      // Get balances
      let balances: { [accountId: string]: Balance } = {};
      try {
        balances = await trueLayerService.getBalances(accountIds);
      } catch (error) {
        console.error('Failed to get balances:', error);
        // Rethrow the error - we want to fail if we can't get real balances
        throw error;
      }

      const accountsWithBalance = accounts.map((account) => ({
        ...account,
        balance: balances[account.account_id] || null,
      }));

      // Save to cache
      await cacheService.setCache('accounts', accountsWithBalance, { expiryMinutes: 5 });
      console.log(`Cached ${accountsWithBalance.length} accounts with balances`);

      // Group accounts by bank for firebase storage
      const bankAccounts: { [key: string]: BankAccount[] } = {};
      accounts.forEach((account) => {
        const bankId = account.institution_id;
        if (!bankAccounts[bankId]) {
          bankAccounts[bankId] = [];
        }
        bankAccounts[bankId].push(account);
      });

      // Save bank connections to Firebase
      for (const [bankId, bankAccountsList] of Object.entries(bankAccounts)) {
        try {
          await firebaseService.saveBankConnection(userId, {
            institutionId: bankId,
            institutionName: bankAccountsList[0].institution_name,
            accessToken: 'mockAccessToken',  // Using placeholder values if real tokens aren't available
            refreshToken: 'mockRefreshToken',
          });
          console.log(`Saved bank connection for ${bankId}`);
        } catch (error) {
          console.warn(`Failed to save bank connection for ${bankId}`, error);
          // Continue with other banks even if one fails
        }
      }

      // Update sync status
      this.syncStatus = {
        lastSync: new Date().toISOString(),
        inProgress: false,
        error: null,
      };

      await cacheService.setCache('syncStatus', this.syncStatus);
      console.log('Account sync completed successfully');
    } catch (error) {
      logError('SyncService.syncAccounts', error);
      this.syncStatus = {
        ...this.syncStatus,
        inProgress: false,
        error: error instanceof Error ? error.message : 'Failed to sync accounts',
      };
      await cacheService.setCache('syncStatus', this.syncStatus);
      
      // Rethrow the error to show appropriate UI feedback
      throw error;
    }
  }

  async init(): Promise<void> {
    try {
      console.log('Initializing SyncService');
      const savedStatus = await cacheService.getCache<SyncStatus>('syncStatus');
      if (savedStatus) {
        console.log('Loaded previous sync status:', savedStatus);
        this.syncStatus = savedStatus;
      } else {
        console.log('No previous sync status found');
      }
    } catch (error) {
      logError('SyncService.init', error);
      console.error('Failed to initialize SyncService');
    }
  }

  async getAccounts(): Promise<(BankAccount & { balance: Balance | null })[]> {
    try {
      // First try to get cached accounts with a short expiry
      const cachedAccounts = await cacheService.getCache<(BankAccount & { balance: Balance | null })[]>('accounts', {
        expiryMinutes: 5,
      });

      if (cachedAccounts && cachedAccounts.length > 0) {
        console.log(`Found ${cachedAccounts.length} accounts in cache`);
        return cachedAccounts;
      }

      console.log('No cached accounts or cache expired, fetching from API');
      
      // Check if we have an access token
      const token = await trueLayerService.getAccessToken();
      if (!token) {
        console.log('No access token available');
        throw new Error('No access token available. Please connect a bank first.');
      }

      // Fetch accounts and balances
      try {
        const accounts = await trueLayerService.getAccounts();
        const accountIds = accounts.map((a) => a.account_id);
        const balances = await trueLayerService.getBalances(accountIds);

        const accountsWithBalance = accounts.map((account) => ({
          ...account,
          balance: balances[account.account_id] || null,
        }));

        // Cache the accounts for future use
        await cacheService.setCache('accounts', accountsWithBalance, { expiryMinutes: 5 });
        console.log(`Cached ${accountsWithBalance.length} accounts`);

        return accountsWithBalance;
      } catch (error) {
        // If we failed to get accounts from the API, check if we have any older cached accounts
        const oldCachedAccounts = await cacheService.getCache<(BankAccount & { balance: Balance | null })[]>('accounts', {
          expiryMinutes: 60 * 24, // Try with a much longer expiry to get any cached data
        });

        if (oldCachedAccounts && oldCachedAccounts.length > 0) {
          console.log(`Found ${oldCachedAccounts.length} accounts in older cache`);
          return oldCachedAccounts;
        }
        
        // No cached accounts at all, rethrow the error
        throw error;
      }
    } catch (error) {
      logError('SyncService.getAccounts', error);
      // We want to be explicit about errors - no automatic fallback to mock data
      throw error;
    }
  }

  // Get transactions for an account 
  async getTransactions(accountId: string, forceRefresh: boolean = false): Promise<Transaction[]> {
    try {
      const cacheKey = `transactions_${accountId}`;
      
      // Check cache first unless force refresh is requested
      if (!forceRefresh) {
        const cachedTransactions = await cacheService.getCache<Transaction[]>(cacheKey, {
          expiryMinutes: 30, // Cache transactions for 30 minutes
        });
        
        if (cachedTransactions && cachedTransactions.length > 0) {
          console.log(`Found ${cachedTransactions.length} transactions in cache for account ${accountId}`);
          return cachedTransactions;
        }
      }
      
      console.log(`Fetching transactions for account ${accountId}`);
      
      // Set date range for last 90 days
      const toDate = moment().format('YYYY-MM-DD');
      const fromDate = moment().subtract(90, 'days').format('YYYY-MM-DD');
      
      // Get transactions from the API
      const transactions = await trueLayerService.getTransactions(accountId, fromDate, toDate);
      
      // Cache the transactions
      await cacheService.setCache(cacheKey, transactions, { expiryMinutes: 30 });
      console.log(`Cached ${transactions.length} transactions for account ${accountId}`);
      
      return transactions;
    } catch (error) {
      logError('SyncService.getTransactions', error);
      
      // Check for old cached transactions as a fallback
      try {
        const cacheKey = `transactions_${accountId}`;
        const oldCachedTransactions = await cacheService.getCache<Transaction[]>(cacheKey, {
          expiryMinutes: 60 * 24 * 7, // Try with a much longer expiry (1 week) to get any cached data
        });
        
        if (oldCachedTransactions && oldCachedTransactions.length > 0) {
          console.log(`Found ${oldCachedTransactions.length} transactions in older cache`);
          return oldCachedTransactions;
        }
      } catch (cacheError) {
        // If even the cache fallback fails, just continue and throw the original error
        console.warn('Failed to retrieve old cached transactions:', cacheError);
      }
      
      // Throw the original error
      throw error;
    }
  }

  // Disconnect a bank
  async disconnectBank(bankId: string): Promise<void> {
    try {
      console.log(`Disconnecting bank with ID: ${bankId}`);
      
      // Get the current user ID
      const userId = firebaseService.getCurrentUserId();
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      // Attempt to revoke access with TrueLayer
      try {
        await trueLayerService.revokeAccess(bankId);
      } catch (error) {
        console.warn('Could not revoke access with TrueLayer, continuing with local removal', error);
        // Continue with local cleanup even if TrueLayer revocation fails
      }
      
      // Remove from Firebase
      await firebaseService.removeBankConnection(userId, bankId);
      console.log(`Removed bank connection from Firebase`);
      
      // Update cached accounts
      const cachedAccounts = await cacheService.getCache<(BankAccount & { balance: Balance | null })[]>('accounts');
      
      if (cachedAccounts) {
        // Filter out accounts from this bank
        const updatedAccounts = cachedAccounts.filter(account => account.institution_id !== bankId);
        
        // Update the cache
        await cacheService.setCache('accounts', updatedAccounts);
        console.log(`Updated cached accounts after disconnecting bank`);
      }
      
      // Remove any transaction caches for this bank's accounts
      const allKeys = await AsyncStorage.getAllKeys();
      const transactionKeysToRemove = allKeys.filter(key => 
        key.startsWith('cache_transactions_') && 
        cachedAccounts?.some(acc => 
          acc.institution_id === bankId && 
          key.includes(acc.account_id)
        )
      );
      
      if (transactionKeysToRemove.length > 0) {
        await AsyncStorage.multiRemove(transactionKeysToRemove);
        console.log(`Removed ${transactionKeysToRemove.length} transaction cache entries`);
      }
      
      console.log(`Bank disconnection completed successfully`);
    } catch (error) {
      logError('SyncService.disconnectBank', error);
      throw error;
    }
  }
}

export const syncService = new SyncService();
syncService.init();