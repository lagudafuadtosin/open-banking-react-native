import React, { createContext, useContext, useEffect, useState } from 'react';
import { networkService, NetworkStatus } from '../services/networkService'; // Updated import
import { syncService } from '../services/syncService';
import { cacheService } from '../services/cacheService';
import { Alert } from 'react-native';
import { logError } from '../utils/errorHandling';

interface OfflineContextProps {
  isOffline: boolean;
  hasCachedData: boolean;
  syncOnReconnect: () => Promise<void>;
  lastSyncTime: string | null;
}

// Define the SyncStatus interface to match what's in syncService
interface SyncStatus {
  lastSync: string | null;
  inProgress: boolean;
  error: string | null;
}

export const OfflineContext = createContext<OfflineContextProps>({
  isOffline: false,
  hasCachedData: false,
  syncOnReconnect: async () => {},
  lastSyncTime: null,
});

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(networkService.getCurrentStatus());
  const [hasCachedData, setHasCachedData] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [wasOffline, setWasOffline] = useState(false);
  
  // Check for cached data on mount
  useEffect(() => {
    checkCachedData();
  }, []);
  
  // Subscribe to network status updates
  useEffect(() => {
    const listener = (status: NetworkStatus) => {
      setNetworkStatus(status);
    };
    
    networkService.addListener(listener);
    
    return () => {
      networkService.removeListener(listener);
    };
  }, []);
  
  // Monitor network status changes
  useEffect(() => {
    const isCurrentlyOffline = !networkStatus.isConnected || !networkStatus.isInternetReachable;
    
    // If we were offline but now online, we need to sync
    if (wasOffline && !isCurrentlyOffline) {
      // Show reconnection message
      Alert.alert(
        'Connection Restored',
        'You are back online. Tap Sync to update your data.',
        [
          {
            text: 'Sync',
            onPress: () => syncOnReconnect(),
          },
          {
            text: 'Later',
            style: 'cancel',
          },
        ]
      );
    }
    
    setWasOffline(isCurrentlyOffline);
  }, [networkStatus, wasOffline]); // Depend on networkStatus and wasOffline
  
  // Check if we have any cached data
  const checkCachedData = async () => {
    try {
      // Check for accounts cache
      const cachedAccounts = await cacheService.getCache('accounts');
      
      // Get sync status with proper typing
      const syncStatus = await cacheService.getCache<SyncStatus>('syncStatus');
      if (syncStatus && syncStatus.lastSync) {
        setLastSyncTime(syncStatus.lastSync);
      }
      
      setHasCachedData(!!cachedAccounts);
    } catch (error) {
      logError('OfflineContext.checkCachedData', error);
    }
  };
  
  // Sync data when coming back online
  const syncOnReconnect = async () => {
    try {
      // This would ideally use the user's ID from auth context
      // For now, using a placeholder
      await syncService.syncAccounts('current_user_id');
      
      // Update last sync time
      const syncStatus = syncService.getSyncStatus();
      setLastSyncTime(syncStatus.lastSync);
      
      // Check cached data again
      await checkCachedData();
    } catch (error) {
      logError('OfflineContext.syncOnReconnect', error);
      Alert.alert('Sync Failed', 'There was a problem syncing your data.');
    }
  };
  
  return (
    <OfflineContext.Provider
      value={{
        isOffline: !networkStatus.isConnected || !networkStatus.isInternetReachable,
        hasCachedData,
        syncOnReconnect,
        lastSyncTime,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};