import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { AuthContext } from '../context/AuthContext';
import { syncService } from '../services/syncService';
import { trueLayerService, BankAccount, Balance } from '../services/trueLayerService';
import { cacheService } from '../services/cacheService';

type DashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Dashboard'>;

interface DashboardScreenProps {
  navigation: DashboardScreenNavigationProp;
}

interface AccountWithBalance extends BankAccount {
  balance?: Balance | null;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { user, logout } = useContext(AuthContext);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [currency, setCurrency] = useState('GBP');
  const [isLoading, setIsLoading] = useState(true);
  const [loadAttempts, setLoadAttempts] = useState(0);

  // Enhanced account loading with retry logic
  const checkTokensAndLoadAccounts = async () => {
    try {
      setIsLoading(true);
      // First check if we have an access token
      const token = await trueLayerService.getAccessToken();
      if (!token) {
        console.log('No access token available, navigating to ConnectBank');
        navigation.navigate('ConnectBank');
        return;
      }

      // Use the existing syncService to get accounts with balances
      try {
        const accountsWithBalance = await syncService.getAccounts();
        
        if (accountsWithBalance && accountsWithBalance.length > 0) {
          setAccounts(accountsWithBalance);

          const total = accountsWithBalance.reduce((sum, account) => {
            return sum + (account.balance?.available ?? 0);
          }, 0);
          setTotalBalance(total);

          const firstBalance = accountsWithBalance.find(acc => acc.balance)?.balance;
          if (firstBalance?.currency) {
            setCurrency(firstBalance.currency);
          }
        } else {
          throw new Error('No accounts found');
        }
      } catch (error: any) {
        console.error('Error loading accounts:', error);
        
        // Check if we have any cached accounts to show instead
        const cachedAccounts = await cacheService.getCache<AccountWithBalance[]>('accounts');
        
        if (cachedAccounts && cachedAccounts.length > 0) {
          console.log('Loading accounts from cache as fallback');
          setAccounts(cachedAccounts);
          
          const total = cachedAccounts.reduce((sum, account) => {
            return sum + (account.balance?.available ?? 0);
          }, 0);
          setTotalBalance(total);
          
          const firstBalance = cachedAccounts.find(acc => acc.balance)?.balance;
          if (firstBalance?.currency) {
            setCurrency(firstBalance.currency);
          }
          
          // Show a message that we're using cached data
          Alert.alert(
            'Using Cached Data',
            'Unable to connect to the bank. Showing your last synced accounts.',
            [{ text: 'OK' }]
          );
        } else if (error.message && error.message.includes('Please connect a bank first')) {
          // If there's a specific error about connecting a bank, navigate to ConnectBank
          navigation.navigate('ConnectBank');
        } else {
          // No cached data and not a "connect bank" error
          if (loadAttempts < 2) {
            // Try one more time after a delay
            setTimeout(() => {
              setLoadAttempts(prev => prev + 1);
              checkTokensAndLoadAccounts();
            }, 2000);
          } else {
            // After retries, show an error
            Alert.alert(
              'Connection Error',
              'Could not load your accounts. Please try again later.',
              [
                { 
                  text: 'Try Again', 
                  onPress: () => {
                    setLoadAttempts(0);
                    checkTokensAndLoadAccounts();
                  }
                },
                { 
                  text: 'Connect Bank', 
                  onPress: () => navigation.navigate('ConnectBank')
                }
              ]
            );
          }
        }
      }
    } catch (error: any) {
      console.error('Error in checkTokensAndLoadAccounts:', error);
      Alert.alert('Error', 'Failed to load your accounts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkTokensAndLoadAccounts();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await checkTokensAndLoadAccounts();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error: any) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading accounts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.profileButton}>Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutButton}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>
            {formatCurrency(totalBalance, currency)}
          </Text>
        </View>

        <View style={styles.accountsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Accounts</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ConnectBank')}>
              <Text style={styles.addButton}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {accounts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                You don't have any connected accounts yet.
              </Text>
              <TouchableOpacity
                style={styles.connectButton}
                onPress={() => navigation.navigate('ConnectBank')}
              >
                <Text style={styles.connectButtonText}>Connect a Bank</Text>
              </TouchableOpacity>
            </View>
          ) : (
            accounts.map((account) => (
              <TouchableOpacity
                key={account.account_id}
                style={styles.accountCard}
                onPress={() => navigation.navigate('TransactionList', { accountId: account.account_id })}
              >
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{account.display_name}</Text>
                  <Text style={styles.accountNumber}>
                    {account.sort_code && account.account_number
                      ? `${account.sort_code} ${account.account_number}`
                      : 'Account'}
                  </Text>
                  <Text style={styles.bankName}>{account.institution_name}</Text>
                </View>
                {account.balance ? (
                  <View style={styles.accountBalance}>
                    {typeof account.balance.available === 'number' && (
                      <>
                        <Text style={styles.balanceAmount}>
                          {formatCurrency(account.balance.available, account.balance.currency)}
                        </Text>
                        <Text style={styles.balanceType}>Available</Text>
                      </>
                    )}
                  </View>
                ) : (
                  <Text style={styles.loadingText}>No balance available</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Payment')}
          >
            <Text style={styles.actionButtonText}>Make a Payment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => navigation.navigate('Accounts')}
          >
            <Text style={styles.secondaryButtonText}>View All Accounts</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    color: '#5f6368',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e3e6',
  },
  welcomeText: {
    fontSize: 14,
    color: '#5f6368',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#202124',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  profileButton: {
    color: '#1a73e8',
    marginRight: 15,
  },
  logoutButton: {
    color: '#ea4335',
  },
  balanceCard: {
    backgroundColor: '#1a73e8',
    padding: 20,
    margin: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  accountsSection: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#202124',
  },
  addButton: {
    color: '#1a73e8',
    fontWeight: 'bold',
  },
  emptyState: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#5f6368',
    textAlign: 'center',
    marginBottom: 20,
  },
  connectButton: {
    backgroundColor: '#1a73e8',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  accountCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#202124',
    marginBottom: 5,
  },
  accountNumber: {
    fontSize: 14,
    color: '#5f6368',
    marginBottom: 5,
  },
  bankName: {
    fontSize: 13,
    color: '#5f6368',
  },
  accountBalance: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  balanceType: {
    fontSize: 13,
    color: '#5f6368',
    marginTop: 2,
  },
  actionsSection: {
    padding: 20,
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#1a73e8',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1a73e8',
  },
  secondaryButtonText: {
    color: '#1a73e8',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default DashboardScreen;