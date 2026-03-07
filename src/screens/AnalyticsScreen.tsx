import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { syncService } from '../services/syncService';
import { Transaction, Balance } from '../services/trueLayerService';
import AccountBalanceChart from '../components/AccountBalanceChart';
import SpendingCategoryChart from '../components/SpendingCategoryChart';
import moment from 'moment';
import COLORS from '../constants/colors';
import { SessionTimeoutWrapper } from '../hooks/SessionTimeoutWrapper';
import Icon from 'react-native-vector-icons/MaterialIcons';

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
  balance?: Balance | null;
}

interface DailyBalance {
  date: string;
  balance: number;
  currency: string;
}

// State management
const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ navigation }) => {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dailyBalances, setDailyBalances] = useState<DailyBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('GBP');
  
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
  
  // Load transactions when account changes
  useEffect(() => {
    if (selectedAccountId) {
      loadAccountData(selectedAccountId);
    }
  }, [selectedAccountId]);
  
  const loadAccounts = async () => {
    try {
      setLoading(true);
      const accountsData = await syncService.getAccounts();
      setAccounts(accountsData);
      
      // Auto-select first account
      if (accountsData.length > 0) {
        setSelectedAccountId(accountsData[0].account_id);
        if (accountsData[0].balance?.currency) {
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
  
  const loadAccountData = async (accountId: string) => {
    try {
      setLoading(true);
      
      // Get selected account info
      const selectedAccount = accounts.find(a => a.account_id === accountId);
      const accountBalance = selectedAccount?.balance?.available || 0;
      
      // Get current month transactions for this account only
      const currentMonth = moment().format('YYYY-MM');
      const allAccountTransactions = await syncService.getTransactions(accountId);
      
      // Filter to current month only
      const currentMonthTransactions = allAccountTransactions.filter(t => 
        moment(t.timestamp).format('YYYY-MM') === currentMonth
      );
      
      console.log(`Account ${accountId}: ${currentMonthTransactions.length} transactions for ${currentMonth}`);
      
      setTransactions(currentMonthTransactions);
      
      // Generate daily balance chart data for current month
      const dailyData = generateDailyBalanceData(currentMonthTransactions, accountBalance);
      setDailyBalances(dailyData);

      /**     // Calculate totalSpending and log all data (rmeove after)
      const totalSpending = currentMonthTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      console.log('dailyBalances:', dailyBalances);
      console.log('currentMonthTransactions:', currentMonthTransactions);
      console.log('startingBalance and totalSpending:', { startingBalance: accountBalance, totalSpending });
      console.log('currency:', currency); */
      
      // Update currency
      if (selectedAccount?.balance?.currency) {
        setCurrency(selectedAccount.balance.currency);
      }
      
    } catch (error) {
      console.error(`Error loading data for account ${accountId}:`, error);
      Alert.alert('Error', 'Failed to load account data. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const generateDailyBalanceData = (transactions: Transaction[], startingBalance: number): DailyBalance[] => {
    const currentMonth = moment().format('YYYY-MM');
    const daysInMonth = moment().daysInMonth();
    const dailyData: DailyBalance[] = [];
    
    // Calculate total spending for the month
    const totalSpending = transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // Starting balance = current balance + total spending this month
    const monthStartBalance = startingBalance + totalSpending;
    let runningBalance = monthStartBalance;
    
    // Generate daily balances for current month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentMonth}-${day.toString().padStart(2, '0')}`;
      const dayTransactions = transactions.filter(t => 
        moment(t.timestamp).format('YYYY-MM-DD') === dateStr
      );
      
      // Calculate spending for this day (only negative amounts)
      const daySpending = dayTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0); // Keep negative to subtract from balance
      
      runningBalance += daySpending; // This will reduce balance (daySpending is negative)
      
      // Ensure balance never goes below the ending balance
      runningBalance = Math.max(runningBalance, startingBalance);
      
      dailyData.push({
        date: dateStr,
        balance: runningBalance,
        currency: 'GBP'
      });
    }
    
    return dailyData;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <SessionTimeoutWrapper>
      <View style={styles.container}>
        <ScrollView 
          refreshControl={
            <RefreshControl 
              refreshing={loading} 
              onRefresh={() => {
                loadAccounts();
              }} 
            />
          }
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Account selector buttons */}
          <View style={styles.accountSelector}>
            <Text style={styles.selectorTitle}>Select Account</Text>
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
                  <Text
                    style={[
                      styles.accountBalance,
                      selectedAccountId === account.account_id && styles.selectedAccountBalance,
                    ]}
                  >
                    {account.balance?.available 
                      ? new Intl.NumberFormat('en-GB', {
                          style: 'currency',
                          currency: account.balance.currency,
                        }).format(account.balance.available)
                      : 'N/A'
                    }
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Charts */}
          <AccountBalanceChart balanceHistory={dailyBalances} currency={currency} />
          <SpendingCategoryChart transactions={transactions} currency={currency} />
          {/* Category Management Button */}
          <TouchableOpacity
            style={styles.manageCategoriesButton}
            onPress={() => navigation.navigate('CategoryManagement')}
          >
            <Icon name="settings" size={20} color={COLORS.primary} style={styles.manageCategoriesIcon} />
            <Text style={styles.manageCategoriesText}>Manage Categories</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SessionTimeoutWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },
  headerButton: {
    marginLeft: 15,
  },
  headerButtonText: {
    color: COLORS.primary,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.gray,
    fontSize: 16,
  },
  accountSelector: {
    
    backgroundColor: COLORS.white,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 15,
  },
  selectorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 10,
  },
  accountButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: COLORS.lightGray,
    minWidth: 120,
    alignItems: 'center',
  },
  selectedAccountButton: {
    backgroundColor: COLORS.primary,
  },
  accountButtonText: {
    color: COLORS.gray,
    fontWeight: '500',
    fontSize: 13,
    marginBottom: 2,
  },
  selectedAccountButtonText: {
    color: COLORS.white,
  },
  accountBalance: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: '400',
  },
  selectedAccountBalance: {
    color: COLORS.white,
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 20,
  },
    manageCategoriesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    padding: 15,
    borderRadius: 10,
    marginTop: 15,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  manageCategoriesIcon: {
    marginRight: 8,
  },
  manageCategoriesText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
});

export default AnalyticsScreen;