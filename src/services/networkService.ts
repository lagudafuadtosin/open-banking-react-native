import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { createContext } from 'react';

export interface NetworkStatus {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: NetInfoStateType;
}

export const NetworkContext = createContext<NetworkStatus>({
  isConnected: null, // Changed to null for unknown initial state
  isInternetReachable: null,
  type: NetInfoStateType.unknown, // Use the enum value from NetInfoStateType
});

export class NetworkService {
  private listeners: ((status: NetworkStatus) => void)[] = [];
  private currentStatus: NetworkStatus = {
    isConnected: null, // Changed to null for unknown initial state
    isInternetReachable: null,
    type: NetInfoStateType.unknown, // Use the enum value from NetInfoStateType
  };

  constructor() {
    // Initialize network status
    this.checkNetworkStatus();

    // Subscribe to network state updates
    NetInfo.addEventListener(this.handleNetworkChange.bind(this));
  }

  private async checkNetworkStatus(): Promise<void> {
    const state = await NetInfo.fetch();
    this.handleNetworkChange(state);
  }

  private handleNetworkChange(state: NetInfoState): void {
    this.currentStatus = {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
    };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentStatus));
  }

  public addListener(listener: (status: NetworkStatus) => void): void {
    this.listeners.push(listener);
    // Notify the new listener with the current status immediately
    listener(this.currentStatus);
  }

  public removeListener(listener: (status: NetworkStatus) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  public getCurrentStatus(): NetworkStatus {
    return { ...this.currentStatus };
  }
}

export const networkService = new NetworkService();