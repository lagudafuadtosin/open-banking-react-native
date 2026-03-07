import AsyncStorage from '@react-native-async-storage/async-storage';
import { logError } from '../utils/errorHandling';

interface CacheOptions {
  expiryMinutes?: number;
}

interface CachedItem<T> {
  data: T;
  timestamp: number;
}

export class CacheService {
  // Set item in cache

  async setCache<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    try {
      const cachedItem: CachedItem<T> = {
        data,
        timestamp: Date.now(),
      };
      
      const serialized = JSON.stringify(cachedItem);
      await AsyncStorage.setItem(`cache_${key}`, serialized);
    } catch (error) {
      logError('CacheService.setCache', error);
    }
  }
  
  // Get item from cache
  // Returns null if item doesn't exist or has expired
  
  async getCache<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const serialized = await AsyncStorage.getItem(`cache_${key}`);
      
      if (!serialized) return null;
      
      const cachedItem: CachedItem<T> = JSON.parse(serialized);
      
      // Check expiry
      if (options.expiryMinutes) {
        const expiryMs = options.expiryMinutes * 60 * 1000;
        const now = Date.now();
        
        if (now - cachedItem.timestamp > expiryMs) {
          // Cache has expired
          await this.removeCache(key);
          return null;
        }
      }
      
      return cachedItem.data;
    } catch (error) {
      logError('CacheService.getCache', error);
      return null;
    }
  }
  
  // Remove item from cache
   
  async removeCache(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`cache_${key}`);
    } catch (error) {
      logError('CacheService.removeCache', error);
    }
  }
  
  // Clear a specific cache entry (I do not think I need this, consider clean up)

  async clearCache(key: string): Promise<void> {
    await this.removeCache(key);
  }
  
  // Clear all cached items to solve logout issue

  async clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    console.log('All keys found:', keys.length);
    const cacheKeys = keys.filter(key => key.startsWith('cache_'));
    console.log('Cache keys to remove:', cacheKeys.length);
    
    for (const key of cacheKeys) {
      await AsyncStorage.removeItem(key);
      console.log('Removed key:', key);
    }
    console.log('Cache clearing completed');
  } catch (error) {
    console.log('Cache clearing failed:', error);
    logError('CacheService.clearAllCache', error);
  }
}
}

export const cacheService = new CacheService();