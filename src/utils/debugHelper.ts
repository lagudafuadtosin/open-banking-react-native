// src/utils/debugHelper.ts
// A utility to help diagnose and fix common issues

import { secureStorage } from '../services/secureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET, TRUELAYER_REDIRECT_URI } from '@env';

/**
 * Get the network state as a string
 */
export async function getNetworkState(): Promise<string> {
  const state = await NetInfo.fetch();
  return JSON.stringify({
    isConnected: state.isConnected,
    isInternetReachable: state.isInternetReachable,
    type: state.type,
    details: state.details,
  }, null, 2);
}

/**
 * Get information about environment variables
 */
export function getEnvInfo(): string {
  return JSON.stringify({
    TRUELAYER_CLIENT_ID: TRUELAYER_CLIENT_ID ? 'SET (length: ' + TRUELAYER_CLIENT_ID.length + ')' : 'MISSING',
    TRUELAYER_CLIENT_SECRET: TRUELAYER_CLIENT_SECRET ? 'SET (length: ' + TRUELAYER_CLIENT_SECRET.length + ')' : 'MISSING',
    TRUELAYER_REDIRECT_URI: TRUELAYER_REDIRECT_URI || 'MISSING',
  }, null, 2);
}

/**
 * Get secure storage info (without revealing actual values)
 */
export async function getSecureStorageInfo(): Promise<string> {
  try {
    const accessToken = await secureStorage.getItem('tl_access_token');
    const refreshToken = await secureStorage.getItem('tl_refresh_token');
    
    return JSON.stringify({
      tl_access_token: accessToken ? `Present (length: ${accessToken.length})` : 'Missing',
      tl_refresh_token: refreshToken ? `Present (length: ${refreshToken.length})` : 'Missing',
    }, null, 2);
  } catch (error) {
    return `Error checking secure storage: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Get AsyncStorage keys (cache info)
 */
export async function getCacheInfo(): Promise<string> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith('cache_'));
    const info: Record<string, string> = {};
    
    for (const key of cacheKeys) {
      const value = await AsyncStorage.getItem(key);
      const valueInfo = value ? `Present (length: ${value.length})` : 'Empty';
      info[key] = valueInfo;
    }
    
    return JSON.stringify({
      totalCacheItems: cacheKeys.length,
      cacheKeys: info,
    }, null, 2);
  } catch (error) {
    return `Error checking AsyncStorage: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Reset tokens and cache to fix authentication issues
 */
export async function resetAuth(): Promise<string> {
  try {
    await secureStorage.removeItem('tl_access_token');
    await secureStorage.removeItem('tl_refresh_token');
    
    // Clear specific cache entries
    await AsyncStorage.removeItem('cache_accounts');
    await AsyncStorage.removeItem('cache_syncStatus');
    
    // Clear any transaction caches
    const keys = await AsyncStorage.getAllKeys();
    const transactionKeys = keys.filter(key => key.startsWith('cache_transactions_'));
    await AsyncStorage.multiRemove(transactionKeys);
    
    return 'Authentication reset successful. Please restart the app and try connecting a bank again.';
  } catch (error) {
    return `Error resetting auth: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Get a complete diagnostic report
 */
export async function getDiagnosticReport(): Promise<string> {
  const sections: string[] = [];
  
  sections.push('=== ENVIRONMENT INFO ===');
  sections.push(getEnvInfo());
  
  sections.push('\n=== NETWORK STATE ===');
  sections.push(await getNetworkState());
  
  sections.push('\n=== SECURE STORAGE INFO ===');
  sections.push(await getSecureStorageInfo());
  
  sections.push('\n=== CACHE INFO ===');
  sections.push(await getCacheInfo());
  
  return sections.join('\n');
}

/**
 * Create mock data storage to test the app without real API
 */
export async function setupMockData(): Promise<string> {
  try {
    // Mock accounts
    const mockAccounts = [
      {
        account_id: 'mock-acc-123',
        institution_id: 'mock',
        institution_name: 'Mock Bank',
        account_number: '12345678',
        sort_code: '04-00-04',
        display_name: 'Current Account',
        balance: {
          current: 2500.75,
          available: 2450.25,
          currency: 'GBP',
          last_updated: new Date().toISOString(),
        }
      },
      {
        account_id: 'mock-acc-456',
        institution_id: 'mock',
        institution_name: 'Mock Bank',
        account_number: '87654321',
        sort_code: '04-00-04',
        display_name: 'Savings Account',
        balance: {
          current: 15000.50,
          available: 15000.50,
          currency: 'GBP',
          last_updated: new Date().toISOString(),
        }
      }
    ];
    
    // Mock transactions
    const mockTransactions = [
      {
        id: 'mock-tx-1',
        timestamp: new Date(Date.now() - 86400000).toISOString(), // yesterday
        description: 'Coffee Shop',
        amount: -4.50,
        currency: 'GBP',
        transaction_type: 'DEBIT',
        transaction_category: 'PURCHASE',
        merchant_name: 'Starbucks',
      },
      {
        id: 'mock-tx-2',
        timestamp: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        description: 'Grocery Store',
        amount: -65.20,
        currency: 'GBP',
        transaction_type: 'DEBIT',
        transaction_category: 'PURCHASE',
        merchant_name: 'Tesco',
      },
      {
        id: 'mock-tx-3',
        timestamp: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
        description: 'Online Shopping',
        amount: -123.45,
        currency: 'GBP',
        transaction_type: 'DEBIT',
        transaction_category: 'PURCHASE',
        merchant_name: 'Amazon',
      },
      {
        id: 'mock-tx-4',
        timestamp: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
        description: 'Salary Payment',
        amount: 2500.00,
        currency: 'GBP',
        transaction_type: 'CREDIT',
        transaction_category: 'INCOME',
        merchant_name: 'Employer Inc',
      }
    ];
    
    // Save mock data to cache
    await AsyncStorage.setItem('cache_accounts', JSON.stringify({
      data: mockAccounts,
      timestamp: Date.now(),
    }));
    
    await AsyncStorage.setItem('cache_transactions_mock-acc-123', JSON.stringify({
      data: mockTransactions,
      timestamp: Date.now(),
    }));
    
    await AsyncStorage.setItem('cache_syncStatus', JSON.stringify({
      data: {
        lastSync: new Date().toISOString(),
        inProgress: false,
        error: null,
      },
      timestamp: Date.now(),
    }));
    
    return 'Mock data setup complete. You can now test the app without connecting to a real bank.';
  } catch (error) {
    return `Error setting up mock data: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Fix the application to use mock data by default
 */
export async function enableOfflineMode(): Promise<string> {
  try {
    // Setup mock data first
    await setupMockData();
    
    // Set a flag to indicate we're in offline mode
    await AsyncStorage.setItem('offline_mode_enabled', 'true');
    
    return 'Offline mode enabled successfully. The app will now use mock data by default.';
  } catch (error) {
    return `Error enabling offline mode: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Disable offline mode
 */
export async function disableOfflineMode(): Promise<string> {
  try {
    await AsyncStorage.removeItem('offline_mode_enabled');
    return 'Offline mode disabled. The app will attempt to use the real API.';
  } catch (error) {
    return `Error disabling offline mode: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Check if offline mode is enabled
 */
export async function isOfflineModeEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem('offline_mode_enabled');
  return value === 'true';
}