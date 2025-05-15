import React, { createContext, useContext, useEffect, useState } from 'react';
import { networkService, NetworkStatus } from '../services/networkService';
import { syncService } from '../services/syncService';
import { cacheService } from '../services/cacheService';
import { Alert } from 'react-native';
import { logError } from '../utils/errorHandling';
import { AuthContext } from '../context/AuthContext';

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
  const { user } = useContext(AuthContext);
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
  }, [networkStatus, wasOffline]);

  // Check if we have any cached data
  const checkCachedData = async () => {
    try {
      const cachedAccounts = await cacheService.getCache('accounts');
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
      if (!user) {
        throw new Error('User not authenticated');
      }
      await syncService.syncAccounts(user.uid);

      const syncStatus = syncService.getSyncStatus();
      setLastSyncTime(syncStatus.lastSync);

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