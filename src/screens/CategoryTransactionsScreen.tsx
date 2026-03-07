import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { Transaction } from '../services/trueLayerService';
import Icon from 'react-native-vector-icons/MaterialIcons';
import moment from 'moment';
import { groupBy } from 'lodash';
import COLORS from '../constants/colors';
import { SessionTimeoutWrapper } from '../hooks/SessionTimeoutWrapper';
import RecategorizeModal from '../components/RecategorizeModal';
import { useAuth } from '../context/AuthContext';

type CategoryTransactionsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CategoryTransactions'>;
type CategoryTransactionsScreenRouteProp = RouteProp<RootStackParamList, 'CategoryTransactions'>;

interface CategoryTransactionsScreenProps {
  navigation: CategoryTransactionsScreenNavigationProp;
  route: CategoryTransactionsScreenRouteProp;
}

const CategoryTransactionsScreen: React.FC<CategoryTransactionsScreenProps> = ({ 
  navigation, 
  route 
}) => {
  const { categoryName, transactions, currency } = route.params;
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [showRecategorizeModal, setShowRecategorizeModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<{
    description: string;
    currentCategory: string;
  } | null>(null);

  useEffect(() => {
    navigation.setOptions({
      title: categoryName,
      headerLeft: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, categoryName]);

  const formatCurrency = (amount: number, transactionCurrency?: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: transactionCurrency || currency || 'GBP',
    }).format(amount);
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

  const handleLongPress = (transaction: Transaction) => {
    setSelectedTransaction({
      description: transaction.description,
      currentCategory: transaction.transaction_category || categoryName,
    });
    setShowRecategorizeModal(true);
  };

  const handleCategoryChanged = async (newCategory: string) => {
    console.log(`Transaction recategorized from ${categoryName} to: ${newCategory}`);
    // Note: In a real app, you might want to remove this transaction from the current view
    // or refresh the parent analytics screen, but for now we'll just close the modal
  };

  const handleCloseModal = () => {
    setShowRecategorizeModal(false);
    setSelectedTransaction(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Since we're working with passed data, we don't really need to refresh
    // But we can simulate it for UX consistency
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
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

  // Group transactions by date
  const getGroupedTransactions = () => {
    return groupBy(transactions, transaction => 
      moment(transaction.timestamp).format('YYYY-MM-DD')
    );
  };

  // Calculate summary stats
  const totalSpent = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const transactionCount = transactions.length;

  const sectionData = Object.entries(getGroupedTransactions()).map(([date, data]) => ({
    title: formatDate(date),
    data
  }));

  return (
    <SessionTimeoutWrapper>
      <View style={styles.container}>
        {/* Summary Header */}
        <View style={styles.summaryContainer}>
          <Text style={styles.categoryTitle}>{categoryName}</Text>
          <Text style={styles.totalAmount}>
            {formatCurrency(totalSpent, currency)}
          </Text>
          <Text style={styles.transactionCount}>
            {transactionCount} transaction{transactionCount !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Transactions List */}
        <SectionList
          sections={sectionData}
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
                No transactions found in this category.
              </Text>
            </View>
          }
        />

        {/* Recategorize Modal */}
        <RecategorizeModal
          visible={showRecategorizeModal}
          onClose={handleCloseModal}
          transaction={selectedTransaction}
          onCategoryChanged={handleCategoryChanged}
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
  headerButton: {
    marginLeft: 15,
    padding: 5,
  },
  summaryContainer: {
    backgroundColor: COLORS.white,
    padding: 20,
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 5,
  },
  transactionCount: {
    fontSize: 14,
    color: COLORS.gray,
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
});

export default CategoryTransactionsScreen;