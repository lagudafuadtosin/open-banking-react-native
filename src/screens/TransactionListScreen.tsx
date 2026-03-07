import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { syncService } from '../services/syncService';
import { Transaction, BankAccount } from '../services/trueLayerService';
import moment from 'moment';
import { groupBy } from 'lodash';
import COLORS from '../constants/colors';
import { SessionTimeoutWrapper } from '../hooks/SessionTimeoutWrapper';
import RecategorizeModal from '../components/RecategorizeModal';
// import { Vibration } from 'react-native'; // For haptic feedback consider removing if it works weird
import { useAuth } from '../context/AuthContext';


type TransactionListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TransactionList'>;
type TransactionListScreenRouteProp = RouteProp<RootStackParamList, 'TransactionList'>;

interface TransactionListScreenProps {
  navigation: TransactionListScreenNavigationProp;
  route: TransactionListScreenRouteProp;
}

type FilterType = 'all' | 'incoming' | 'outgoing';

const TransactionListScreen: React.FC<TransactionListScreenProps> = ({ navigation, route }) => {
  const { accountId } = route.params;
  const { user } = useAuth();
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Date filtering state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [tempFromDateText, setTempFromDateText] = useState('');
  const [tempToDateText, setTempToDateText] = useState('');
  const [fromDateError, setFromDateError] = useState('');
  const [toDateError, setToDateError] = useState('');
  
  // added for long press and user defined category
  const [showRecategorizeModal, setShowRecategorizeModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<{
    description: string;
    currentCategory: string;
  } | null>(null);

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
      const transactionsData = await syncService.getTransactions(accountId, true);
      
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

  // Date input formatting and validation functions
  const formatDateInput = (input: string): string => {
    // Remove all non-numeric characters
    const numbers = input.replace(/[^0-9]/g, '');
    
    // Limit to 8 digits (DDMMYYYY)
    const limited = numbers.substring(0, 8);
    
    // Add slashes: 12 -> 12, 1234 -> 12/34, 12345678 -> 12/34/5678
    if (limited.length <= 2) {
      return limited;
    } else if (limited.length <= 4) {
      return `${limited.substring(0, 2)}/${limited.substring(2)}`;
    } else {
      return `${limited.substring(0, 2)}/${limited.substring(2, 4)}/${limited.substring(4)}`;
    }
  };

  const validateDateInput = (dateText: string): { isValid: boolean; error: string; date?: Date } => {
    if (!dateText) {
      return { isValid: false, error: 'Date is required' };
    }

    // Check format pattern (DD/MM/YYYY)
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = dateText.match(dateRegex);
    
    if (!match) {
      return { isValid: false, error: 'Please use DD/MM/YYYY format' };
    }

    const [, dayStr, monthStr, yearStr] = match;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    // Basic range checks
    if (day < 1 || day > 31) {
      return { isValid: false, error: 'Day must be between 01-31' };
    }
    if (month < 1 || month > 12) {
      return { isValid: false, error: 'Month must be between 01-12' };
    }
    if (year < 1900 || year > new Date().getFullYear()) {
      return { isValid: false, error: `Year must be between 1900-${new Date().getFullYear()}` };
    }

    // Use moment.js for strict date validation (handles leap years, days in month, etc.)
    const momentDate = moment(dateText, 'DD/MM/YYYY', true);
    
    if (!momentDate.isValid()) {
      return { isValid: false, error: 'Invalid date (check days in month)' };
    }

    // Check if date is not in the future
    if (momentDate.isAfter(moment(), 'day')) {
      return { isValid: false, error: 'Date cannot be in the future' };
    }

    return { isValid: true, error: '', date: momentDate.toDate() };
  };

  const handleFromDateChange = (text: string) => {
    const formatted = formatDateInput(text);
    setTempFromDateText(formatted);
    
    // Only validate if we have a complete date (10 characters)
    if (formatted.length === 10) {
      const validation = validateDateInput(formatted);
      setFromDateError(validation.error);
    } else if (formatted.length > 0) {
      setFromDateError('');
    }
  };

  const handleToDateChange = (text: string) => {
    const formatted = formatDateInput(text);
    setTempToDateText(formatted);
    
    // Only validate if we have a complete date (10 characters)
    if (formatted.length === 10) {
      const validation = validateDateInput(formatted);
      setToDateError(validation.error);
    } else if (formatted.length > 0) {
      setToDateError('');
    }
  };

  const handleFromDateBlur = () => {
    if (tempFromDateText && tempFromDateText.length === 10) {
      const validation = validateDateInput(tempFromDateText);
      setFromDateError(validation.error);
    }
  };

  const handleToDateBlur = () => {
    if (tempToDateText && tempToDateText.length === 10) {
      const validation = validateDateInput(tempToDateText);
      setToDateError(validation.error);
    }
  };
  
  // Filter transactions by date range if set
  const filterByDate = (transaction: Transaction): boolean => {
    if (!fromDate || !toDate) return true;
    
    const transactionDate = moment(transaction.timestamp);
    const start = moment(fromDate);
    const end = moment(toDate);
    
    return transactionDate.isBetween(start, end, 'day', '[]');
  };
  
  const getFilteredTransactions = () => {
    let filtered = transactions;
    
    if (filter === 'incoming') filtered = filtered.filter(t => t.amount > 0);
    if (filter === 'outgoing') filtered = filtered.filter(t => t.amount < 0);
    
    // Apply date filter
    filtered = filtered.filter(filterByDate);
    
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
  
  const handleApplyDateFilter = () => {
    // Validate both dates
    const fromValidation = validateDateInput(tempFromDateText);
    const toValidation = validateDateInput(tempToDateText);
    
    if (!fromValidation.isValid) {
      setFromDateError(fromValidation.error);
      return;
    }
    
    if (!toValidation.isValid) {
      setToDateError(toValidation.error);
      return;
    }
    
    // Check date range logic
    if (moment(toValidation.date).isBefore(moment(fromValidation.date))) {
      Alert.alert('Invalid Range', 'End date must be after start date.');
      return;
    }
    
    // All validations passed
    setFromDate(fromValidation.date!);
    setToDate(toValidation.date!);
    setShowDatePicker(false);
    setFromDateError('');
    setToDateError('');
  };
  
  const clearDateFilter = () => {
    setFromDate(null);
    setToDate(null);
    setTempFromDateText('');
    setTempToDateText('');
    setFromDateError('');
    setToDateError('');
    setShowDatePicker(false);
  };
  
  /** This is old rendertransaction, befire user defined category 
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
  */
  // New render for longpress and handlelongpress function

      const handleLongPress = (transaction: Transaction) => {
    //  Vibration.vibrate(50); // Quick haptic feedback
      setSelectedTransaction({
        description: transaction.description,
        currentCategory: transaction.transaction_category || 'Uncategorized',
      });
      setShowRecategorizeModal(true);
    };

    const handleCategoryChanged = async (newCategory: string) => {
      console.log(`Transaction recategorized to: ${newCategory}`);
      
      // Automatically refresh transactions to show the new categorization
      try {
        console.log('Refreshing transactions to apply new category rule...');
        await loadTransactions(); // This will re-run categorization with the new rule
        console.log('Transactions refreshed successfully');
      } catch (error) {
        console.error('Error refreshing transactions:', error);
        // Don't show error to user - the rule was saved successfully note 
      }
    };

    const handleCloseModal = () => {
      setShowRecategorizeModal(false);
      setSelectedTransaction(null);
    };

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
  const isIncoming = item.amount > 0;
  
  return (
    <TouchableOpacity 
      style={styles.transactionItem}
      onLongPress={() => handleLongPress(item)}
      delayLongPress={500}
      activeOpacity={0.7}
    >
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
    </TouchableOpacity>
  );
};

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  return (
    <SessionTimeoutWrapper>
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color={COLORS.gray} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions..."
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>
      
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
      
      {/* Date Filter Button */}
      <View style={styles.dateFilterContainer}>
        <TouchableOpacity
          style={styles.dateFilterButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Icon name="date-range" size={16} color={COLORS.primary} />
          <Text style={styles.dateFilterText}>
            {fromDate && toDate ? 
              `${moment(fromDate).format('DD/MM/YYYY')} - ${moment(toDate).format('DD/MM/YYYY')}` : 
              'Filter by Date'
            }
          </Text>
        </TouchableOpacity>
        {fromDate && toDate && (
          <TouchableOpacity onPress={clearDateFilter}>
            <Text style={styles.clearFilterText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <SectionList
        sections={Object.entries(getGroupedTransactions()).map(([date, data]) => ({
          title: formatDate(date),
          data
        }))}
        keyExtractor={(item) => item.id}
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
      
      {/* Date Range Picker Modal */}
      <Modal visible={showDatePicker} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter by Date Range</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>From Date (DD/MM/YYYY):</Text>
              <TextInput
                style={[styles.dateTextInput, fromDateError ? styles.inputError : null]}
                value={tempFromDateText}
                onChangeText={handleFromDateChange}
                onBlur={handleFromDateBlur}
                placeholder="DD/MM/YYYY"
                keyboardType="numeric"
                maxLength={10}
              />
              {fromDateError ? <Text style={styles.errorText}>{fromDateError}</Text> : null}
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>To Date (DD/MM/YYYY):</Text>
              <TextInput
                style={[styles.dateTextInput, toDateError ? styles.inputError : null]}
                value={tempToDateText}
                onChangeText={handleToDateChange}
                onBlur={handleToDateBlur}
                placeholder="DD/MM/YYYY"
                keyboardType="numeric"
                maxLength={10}
              />
              {toDateError ? <Text style={styles.errorText}>{toDateError}</Text> : null}
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowDatePicker(false);
                  setFromDateError('');
                  setToDateError('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.primaryButton]}
                onPress={handleApplyDateFilter}
              >
                <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <RecategorizeModal
        visible={showRecategorizeModal}
        onClose={handleCloseModal}
        transaction={selectedTransaction}
        onCategoryChanged={handleCategoryChanged}
       // userId={user?.uid}
      />
    </View>
    </SessionTimeoutWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
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
    color: COLORS.text,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 10,
  },
  activeFilter: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    color: COLORS.gray,
    fontWeight: '500',
  },
  activeFilterText: {
    color: COLORS.white,
  },
  // Date filter styles
  dateFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  dateFilterText: {
    marginLeft: 5,
    color: COLORS.primary,
    fontSize: 14,
  },
  clearFilterText: {
    color: COLORS.error,
    fontSize: 14,
  },
  transactionsList: {
    paddingVertical: 10,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: COLORS.white,
    marginVertical: 4,
    marginHorizontal: 10,
    borderRadius: 8,
    shadowColor: COLORS.black,
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
    color: COLORS.text,
  },
  transactionDate: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  merchantName: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 2,
  },
  transactionCategory: {
    fontSize: 12,
    color: COLORS.gray,
    backgroundColor: COLORS.lightGray,
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
    color: COLORS.success,
  },
  outgoingAmount: {
    color: COLORS.error,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    color: COLORS.gray,
    fontSize: 16,
    textAlign: 'center',
  },
  sectionHeader: {
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
    color: COLORS.text,
    fontWeight: '500',
  },
  dateTextInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: COLORS.white,
    color: COLORS.text,
  },
  inputError: {
    borderColor: COLORS.error,
    borderWidth: 2,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modalButtonText: {
    fontSize: 16,
    color: COLORS.text,
  },
  primaryButtonText: {
    color: COLORS.white,
  },
});

export default TransactionListScreen;