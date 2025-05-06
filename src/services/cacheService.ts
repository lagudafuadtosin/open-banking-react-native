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
  /**
   * Set item in cache
   */
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
  
  /**
   * Get item from cache
   * Returns null if item doesn't exist or has expired
   */
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
  
  /**
   * Remove item from cache
   */
  async removeCache(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`cache_${key}`);
    } catch (error) {
      logError('CacheService.removeCache', error);
    }
  }
  
  /**
   * Clear a specific cache entry (alias for removeCache)
   */
  async clearCache(key: string): Promise<void> {
    await this.removeCache(key);
  }
  
  /**
   * Clear all cached items
   */
  async clearAllCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      logError('CacheService.clearAllCache', error);
    }
  }
}

export const cacheService = new CacheService();