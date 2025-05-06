import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { syncService } from '../services/syncService';
import { BankAccount, Balance } from '../services/trueLayerService';
import Icon from 'react-native-vector-icons/MaterialIcons';

type AccountsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Accounts'>;

interface AccountsScreenProps {
  navigation: AccountsScreenNavigationProp;
}

interface AccountWithBalance extends BankAccount {
  balance?: Balance | null; // Adjusted to match syncService.getAccounts return type
}

const AccountsScreen: React.FC<AccountsScreenProps> = ({ navigation }) => {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [accountsByBank, setAccountsByBank] = useState<{[key: string]: AccountWithBalance[]}>({}); 

  useEffect(() => {
    loadAccounts();
    navigation.setOptions({
      title: 'All Accounts',
      headerRight: () => (
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.navigate('ConnectBank')}
        >
          <Icon name="add" size={24} color="#1a73e8" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const loadAccounts = async () => {
    try {
      setRefreshing(true);
      // Use syncService to get accounts (includes balances)
      const accountsData: AccountWithBalance[] = await syncService.getAccounts();
      
      setAccounts(accountsData);
      
      // Group accounts by bank
      const grouped = accountsData.reduce((acc, account) => {
        const bankId = account.institution_id;
        if (!acc[bankId]) {
          acc[bankId] = [];
        }
        acc[bankId].push(account);
        return acc;
      }, {} as {[key: string]: AccountWithBalance[]});
      
      setAccountsByBank(grouped);
    } catch (error) {
      console.error('Error loading accounts:', error);
      Alert.alert('Error', 'Failed to load your accounts. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
    }).format(amount);
  };

  const renderBankSection = ({ item: bankId }: { item: string }) => {
    const bankAccounts = accountsByBank[bankId];
    const bankName = bankAccounts[0]?.institution_name || 'Bank';
    
    return (
      <View style={styles.bankSection}>
        <View style={styles.bankHeader}>
          <Text style={styles.bankName}>{bankName}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('LinkedBanks')}>
            <Text style={styles.manageLink}>Manage</Text>
          </TouchableOpacity>
        </View>
        
        {bankAccounts.map(account => (
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
            </View>
            {account.balance ? (
              <View style={styles.accountBalance}>
                {typeof account.balance.available === 'number' ? (
                  <>
                    <Text style={styles.balanceAmount}>
                      {formatCurrency(account.balance.available, account.balance.currency)}
                    </Text>
                    <Text style={styles.balanceType}>Available</Text>
                  </>
                ) : null}
                {typeof account.balance.current === 'number' &&
                account.balance.current !== account.balance.available && (
                  <>
                    <Text style={styles.balanceAmount}>
                      {formatCurrency(account.balance.current, account.balance.currency)}
                    </Text>
                    <Text style={styles.balanceType}>Current</Text>
                  </>
                )}
              </View>
            ) : (
              <Text style={styles.loadingText}>No balance available</Text> // Updated text for clarity
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={Object.keys(accountsByBank)}
        renderItem={renderBankSection}
        keyExtractor={item => item}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadAccounts} />
        }
        ListEmptyComponent={
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
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  headerButton: {
    marginRight: 15,
  },
  listContainer: {
    padding: 15,
  },
  bankSection: {
    marginBottom: 20,
  },
  bankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bankName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#202124',
  },
  manageLink: {
    color: '#1a73e8',
    fontSize: 14,
  },
  accountCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
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
  accountBalance: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#202124',
  },
  balanceType: {
    fontSize: 12,
    color: '#5f6368',
    marginTop: 2,
    marginBottom: 8,
  },
  loadingText: {
    color: '#5f6368',
    fontSize: 14,
  },
  emptyState: {
    padding: 30,
    alignItems: 'center',
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
});

export default AccountsScreen;