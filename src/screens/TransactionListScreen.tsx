import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { syncService } from '../services/syncService';
import { Transaction, BankAccount } from '../services/trueLayerService';
import moment from 'moment';
import { groupBy } from 'lodash';

type TransactionListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TransactionList'>;
type TransactionListScreenRouteProp = RouteProp<RootStackParamList, 'TransactionList'>;

interface TransactionListScreenProps {
  navigation: TransactionListScreenNavigationProp;
  route: TransactionListScreenRouteProp;
}

type FilterType = 'all' | 'incoming' | 'outgoing';

const TransactionListScreen: React.FC<TransactionListScreenProps> = ({ navigation, route }) => {
  const { accountId } = route.params;
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchText, setSearchText] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const loadAccountDetails = async () => {
    try {
      const accounts = await syncService.getAccounts();
      const currentAccount = accounts.find(acc => acc.account_id === accountId);
      if (currentAccount) {
        setAccount(currentAccount);
        navigation.setOptions({
          title: currentAccount.display_name || 'Transactions',
        });
      }
    } catch (error: any) {
      console.error('Error loading account details:', error);
      Alert.alert('Error', 'Failed to load account details. Please try again.');
    }
  };
  
  const loadTransactions = async () => {
    try {
      setRefreshing(true);
      const transactionsData = await syncService.getTransactions(accountId, true); // Force refresh
      
      const sortedTransactions = transactionsData.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      setTransactions(sortedTransactions);
    } catch (error: any) {
      console.error('Error loading transactions:', error);
      Alert.alert('Error', 'Failed to load transactions. Please try again.');
    } finally {
      setRefreshing(false);
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    const loadData = async () => {
      await loadAccountDetails();
      await loadTransactions();
    };
    loadData();
  }, [accountId]);
  
  useEffect(() => {
    if (transactions.length > 0) {
      const uniqueCategories = Array.from(
        new Set(transactions.map(t => t.transaction_type).filter(Boolean))
      ) as string[];
      setCategories(uniqueCategories);
    }
  }, [transactions]);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };
  
  const formatCurrency = (amount: number, currency?: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
    }).format(amount);
  };
  
  const getFilteredTransactions = () => {
    let filtered = transactions;
    
    if (filter === 'incoming') filtered = filtered.filter(t => t.amount > 0);
    if (filter === 'outgoing') filtered = filtered.filter(t => t.amount < 0);
    
    if (selectedCategory) {
      filtered = filtered.filter(t => t.transaction_type === selectedCategory);
    }
    
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(search) || 
        (t.merchant_name && t.merchant_name.toLowerCase().includes(search))
      );
    }
    
    return filtered;
  };
  
  const getGroupedTransactions = () => {
    const filtered = getFilteredTransactions();
    return groupBy(filtered, transaction => 
      moment(transaction.timestamp).format('YYYY-MM-DD')
    );
  };
  
  const formatDate = (dateString: string) => {
    const date = moment(dateString, 'YYYY-MM-DD');
    const today = moment().startOf('day');
    const yesterday = moment().subtract(1, 'day').startOf('day');
    
    if (date.isSame(today, 'day')) {
      return 'Today';
    } else if (date.isSame(yesterday, 'day')) {
      return 'Yesterday';
    } else {
      return date.format('dddd, MMMM D, YYYY');
    }
  };
  
  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const isIncoming = item.amount > 0;
    
    return (
      <View style={styles.transactionItem}>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDescription}>{item.description}</Text>
          <Text style={styles.transactionDate}>
            {moment(item.timestamp).format('DD MMM YYYY, HH:mm')}
          </Text>
          {item.merchant_name && (
            <Text style={styles.merchantName}>{item.merchant_name}</Text>
          )}
          <Text style={styles.transactionCategory}>
            {item.transaction_type || 'Uncategorized'}
          </Text>
        </View>
        <Text
          style={[
            styles.transactionAmount,
            isIncoming ? styles.incomingAmount : styles.outgoingAmount,
          ]}
        >
          {formatCurrency(Math.abs(item.amount), item.currency)}
          {isIncoming ? ' +' : ' -'}
        </Text>
      </View>
    );
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#5f6368" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions..."
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>
      
      {categories.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              selectedCategory === null && styles.selectedCategoryChip,
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === null && styles.selectedCategoryChipText,
              ]}
            >
              All Categories
            </Text>
          </TouchableOpacity>
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                selectedCategory === category && styles.selectedCategoryChip,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === category && styles.selectedCategoryChipText,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.activeFilter]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[styles.filterText, filter === 'all' && styles.activeFilterText]}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'incoming' && styles.activeFilter]}
          onPress={() => setFilter('incoming')}
        >
          <Text
            style={[styles.filterText, filter === 'incoming' && styles.activeFilterText]}
          >
            Incoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'outgoing' && styles.activeFilter]}
          onPress={() => setFilter('outgoing')}
        >
          <Text
            style={[styles.filterText, filter === 'outgoing' && styles.activeFilterText]}
          >
            Outgoing
          </Text>
        </TouchableOpacity>
      </View>
      
      <SectionList
        sections={Object.entries(getGroupedTransactions()).map(([date, data]) => ({
          title: formatDate(date),
          data
        }))}
        keyExtractor={(item) => item.id} // Update to use item.id
        renderItem={renderTransactionItem}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{title}</Text>
          </View>
        )}
        contentContainerStyle={styles.transactionsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No transactions found for the selected filters.
            </Text>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#202124',
  },
  categoriesScroll: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 5,
  },
  categoryChip: {
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  selectedCategoryChip: {
    backgroundColor: '#1a73e8',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#5f6368',
  },
  selectedCategoryChipText: {
    color: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e3e6',
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 10,
  },
  activeFilter: {
    backgroundColor: '#1a73e8',
  },
  filterText: {
    color: '#5f6368',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#fff',
  },
  transactionsList: {
    paddingVertical: 10,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#fff',
    marginVertical: 4,
    marginHorizontal: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    color: '#202124',
  },
  transactionDate: {
    fontSize: 12,
    color: '#5f6368',
    marginBottom: 4,
  },
  merchantName: {
    fontSize: 12,
    color: '#5f6368',
    marginBottom: 2,
  },
  transactionCategory: {
    fontSize: 12,
    color: '#5f6368',
    backgroundColor: '#f1f3f4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
    alignSelf: 'center',
  },
  incomingAmount: {
    color: '#34a853',
  },
  outgoingAmount: {
    color: '#ea4335',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#5f6368',
    fontSize: 16,
    textAlign: 'center',
  },
  sectionHeader: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e3e6',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5f6368',
  },
});

export default TransactionListScreen;