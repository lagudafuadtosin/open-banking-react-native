import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { syncService } from '../services/syncService';
import { Transaction, Balance } from '../services/trueLayerService';
import { networkService, NetworkStatus } from '../services/networkService'; // Updated import
import AccountBalanceChart from '../components/AccountBalanceChart';
import SpendingCategoryChart from '../components/SpendingCategoryChart';
import moment from 'moment';

type AnalyticsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Analytics'>;

interface AnalyticsScreenProps {
  navigation: AnalyticsScreenNavigationProp;
}

interface AccountWithBalance {
  account_id: string;
  institution_id: string;
  institution_name: string;
  account_number?: string;
  sort_code?: string;
  display_name: string;
  balance?: Balance | null; // Align with syncService.getAccounts()
}

interface BalanceHistoryEntry {
  current: number;
  available?: number;
  currency: string;
  last_updated: string;
}

const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ navigation }) => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(networkService.getCurrentStatus());
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('GBP');
  
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
  
  useEffect(() => {
    navigation.setOptions({
      title: 'Analytics',
      headerLeft: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.headerButtonText}>Back</Text>
        </TouchableOpacity>
      ),
    });
    loadAccounts();
  }, [navigation]);
  
  useEffect(() => {
    if (selectedAccountId) {
      loadTransactions(selectedAccountId);
    }
  }, [selectedAccountId]);
  
  const loadAccounts = async () => {
    try {
      setLoading(true);
      const accountsData = await syncService.getAccounts();
      
      setAccounts(accountsData);
      
      if (accountsData.length > 0) {
        setSelectedAccountId(accountsData[0].account_id);
        if (accountsData[0].balance && accountsData[0].balance.currency) {
          setCurrency(accountsData[0].balance.currency);
        }
      }
    } catch (error) {
      console.error('Error loading accounts for analytics:', error);
      Alert.alert('Error', 'Failed to load your accounts. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const loadTransactions = async (accountId: string) => {
    try {
      setLoading(true);
      const transactionsData = await syncService.getTransactions(accountId);
      
      setTransactions(transactionsData);
      
      const today = moment();
      const mockBalanceHistory: BalanceHistoryEntry[] = [];
      
      const selectedAccount = accounts.find(a => a.account_id === accountId);
      const currentBalance = selectedAccount?.balance?.available ?? 1000;
      
      for (let i = 0; i < 30; i++) {
        const date = moment(today).subtract(i, 'days');
        const randomVariation = (Math.random() - 0.5) * 0.05;
        const balanceVariation = currentBalance * randomVariation;
        const dayBalance = currentBalance + (balanceVariation * i);
        
        mockBalanceHistory.push({
          current: dayBalance,
          available: dayBalance,
          currency: selectedAccount?.balance?.currency || 'GBP',
          last_updated: date.toISOString(),
        });
      }
      
      mockBalanceHistory.sort((a, b) => 
        new Date(a.last_updated).getTime() - new Date(b.last_updated).getTime()
      );
      
      setBalanceHistory(mockBalanceHistory);
    } catch (error) {
      console.error(`Error loading transactions for account ${accountId}:`, error);
      Alert.alert('Error', 'Failed to load transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {!networkStatus.isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            You're offline. Some data may not be up to date.
          </Text>
        </View>
      )}
      
      <View style={styles.accountSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {accounts.map(account => (
            <TouchableOpacity
              key={account.account_id}
              style={[
                styles.accountButton,
                selectedAccountId === account.account_id && styles.selectedAccountButton,
              ]}
              onPress={() => setSelectedAccountId(account.account_id)}
            >
              <Text
                style={[
                  styles.accountButtonText,
                  selectedAccountId === account.account_id && styles.selectedAccountButtonText,
                ]}
              >
                {account.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      <ScrollView style={styles.content}>
        <AccountBalanceChart balanceHistory={balanceHistory} currency={currency} />
        <SpendingCategoryChart transactions={transactions} currency={currency} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerButton: {
    marginLeft: 15,
  },
  headerButtonText: {
    color: '#1a73e8',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#5f6368',
    fontSize: 16,
  },
  offlineBanner: {
    backgroundColor: '#fbbc04',
    padding: 10,
    alignItems: 'center',
  },
  offlineBannerText: {
    color: '#202124',
    fontSize: 14,
  },
  accountSelector: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e3e6',
  },
  accountButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#f1f3f4',
  },
  selectedAccountButton: {
    backgroundColor: '#1a73e8',
  },
  accountButtonText: {
    color: '#5f6368',
    fontWeight: '500',
  },
  selectedAccountButtonText: {
    color: '#fff',
  },
  content: {
    padding: 15,
  },
});

export default AnalyticsScreen;