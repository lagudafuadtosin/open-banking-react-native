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
        console.log('Failed to get accounts:', error);
        throw error;
      }

      const accountIds = accounts.map((a) => a.account_id);
      
      // Get balances
      let balances: { [accountId: string]: Balance } = {};
      try {
        balances = await trueLayerService.getBalances(accountIds);
      } catch (error) {
        console.log('Failed to get balances:', error);
        throw error;
      }

      const accountsWithBalance = accounts.map((account) => ({
        ...account,
        balance: balances[account.account_id] || null,
      }));

      // Save to cache
      await cacheService.setCache('accounts', accountsWithBalance, { expiryMinutes: 2 });
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
      console.log('Failed to initialize SyncService');
    }
  }

  async getAccounts(): Promise<(BankAccount & { balance: Balance | null })[]> {
  try {
    // First try to get cached accounts with a short expiry
    const cachedAccounts = await cacheService.getCache<(BankAccount & { balance: Balance | null })[]>('accounts', {
      expiryMinutes: 2, // Changed from 2 for app benefit
    });

    if (cachedAccounts && cachedAccounts.length > 0) {
      console.log(`Found ${cachedAccounts.length} accounts in cache`);
      return cachedAccounts;
    }

    console.log('No cached accounts or cache expired, fetching from API');
    
    // Check for access token
    const token = await trueLayerService.getAccessToken();
    if (!token) {
      console.log('No access token available');
      throw new Error('No access token available. Please connect a bank first.');
    }

    // Fetch accounts and balances
    const accounts = await trueLayerService.getAccounts();
    const accountIds = accounts.map((a) => a.account_id);
    const balances = await trueLayerService.getBalances(accountIds);

    const accountsWithBalance = accounts.map((account) => ({
      ...account,
      balance: balances[account.account_id] || null,
    }));

    // Cache the accounts for future use
    console.log(`Cached ${accountsWithBalance.length} accounts`);

    return accountsWithBalance;
    
    // Removed, all the old cache fallback thing causing app to fail
    
  } catch (error) {
    logError('SyncService.getAccounts', error);
    throw error; // Let it fail properly instead of using old cache
  }
}

  // Get transactions for an account 
  async getTransactions(accountId: string, forceRefresh: boolean = false): Promise<Transaction[]> {
  try {
    const cacheKey = `transactions_${accountId}`;
    
    // Check cache first unless force refresh is requested
    if (!forceRefresh) {
      const cachedTransactions = await cacheService.getCache<Transaction[]>(cacheKey, {
        expiryMinutes: 2, // Changed to 2
      });
      
      if (cachedTransactions && cachedTransactions.length > 0) {
        console.log(`Found ${cachedTransactions.length} transactions in cache for account ${accountId}`);
        return cachedTransactions;
      }
    }
    
    console.log(`Fetching transactions for account ${accountId}`);
    
    // Set date range for last 90 days
    const toDate = moment.utc().format('YYYY-MM-DD');
    const fromDate = moment.utc().subtract(90, 'days').format('YYYY-MM-DD');
    
    // Get transactions from the API
    const transactions = await trueLayerService.getTransactions(accountId, fromDate, toDate);
    
    // Cache the transactions
    await cacheService.setCache(cacheKey, transactions, { expiryMinutes: 2 });
    console.log(`Cached ${transactions.length} transactions for account ${accountId}`);
    
    return transactions;
    
    // Removed, all the old cache fallback thing causing app to fail
    
  } catch (error) {
    logError('SyncService.getTransactions', error);
    throw error; // Let it fail properly instead of using old cache
  }
}

}

export const syncService = new SyncService();
syncService.init();