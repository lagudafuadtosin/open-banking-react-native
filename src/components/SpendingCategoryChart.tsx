import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Transaction } from '../services/trueLayerService';
import moment from 'moment';
import COLORS from '../constants/colors';
import { aiService } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';

// Navigation to 
type NavigationProp = StackNavigationProp<RootStackParamList>;

interface SpendingCategoryChartProps {
  transactions: Transaction[];
  currency: string;
}

interface CategoryData {
  name: string;
  total: number;
  count: number;
  percentage: number;
}

const SpendingCategoryChart: React.FC<SpendingCategoryChartProps> = ({ 
  transactions, 
  currency 
}) => {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);

  // State to store transaction category mapping
  const [transactionsByCategory, setTransactionsByCategory] = useState<{ [category: string]: Transaction[] }>({});


  // Filter transactions to current month
  const currentMonth = moment().format('YYYY-MM');
  const outgoingTransactions = transactions.filter(t => 
    t.amount < 0 && moment(t.timestamp).format('YYYY-MM') === currentMonth
  );

  /* I moved this to AI Service
  
  // Categorize transactions based on description keywords (this is not ideal)
  const categorizeTransaction = (description: string): string => {
    const desc = description.toUpperCase();
    
    if (desc.includes('TESCO') || desc.includes('STORE') || desc.includes('SHOP') || 
        desc.includes('ASDA') || desc.includes('SAINSBURY') || desc.includes('LIDL') ||
        desc.includes('SPAR') || desc.includes('DUNNES') || desc.includes('SUPERVALUE') ||
        desc.includes('CENTRA')) {
      return 'Shopping & Groceries';
    }
    if (desc.includes('ATM')) {
      return 'ATM Withdrawals';
    }
    if (desc.includes('GAMES') || desc.includes('ENTERTAINMENT') || desc.includes('BET365') ||
        desc.includes('VIRGIN GAMES')) {
      return 'Entertainment';
    }
    if (desc.includes('GOOGLE PLAY') || desc.includes('APP STORE') || desc.includes('DIGITAL')) {
      return 'Digital Services';
    }
    if (desc.includes('TELECOM') || desc.includes('PHONE') || desc.includes('INTERNET') || 
        desc.includes('TALKTALK') || desc.includes('E.ON') || desc.includes('OVO ENERGY')) {
      return 'Utilities & Telecom';
    }
    if (desc.includes('MEMBERSHIP') || desc.includes('SUBSCRIPTION') || desc.includes('AA MEMBERSHIP')) {
      return 'Subscriptions';
    }
    if (desc.includes('OVERDRAFT') || desc.includes('FEE') || desc.includes('CHARGE')) {
      return 'Bank Fees';
    }
    if (desc.includes('SAVE THE CHANGE')) {
      return 'Savings & Investments';
    }
    if (desc.includes('INSURANCE') || desc.includes('L&G') || desc.includes('HALIFAX')) {
      return 'Insurance & Finance';
    }
    if (desc.includes('MCDONALD') || desc.includes('RESTAURANT') || desc.includes('CAFE')) {
      return 'Dining & Food';
    }
    if (desc.includes('HARVEY NORMAN') || desc.includes('RETAIL')) {
      return 'Retail & Electronics';
    }
    if (desc.includes('CIRCLE K') || desc.includes('PETROL') || desc.includes('FUEL') ||
        desc.includes('APLLEGREEN')) {
      return 'Fuel & Transport';
    }
    // Check if it's a personal name (contains common titles or looks like a name)
    if (desc.match(/^(MR|MS|MRS|DR|MISS)\s/) || desc.match(/^[A-Z]+\s[A-Z]+$/)) {
      return 'Personal Transfers';
    }
    
    return 'Miscellaneous';
  };
  
  // Group transactions by category
  const categoryTotals: { [key: string]: { total: number; count: number } } = {};
  
  outgoingTransactions.forEach(transaction => {
    const category = categorizeTransaction(transaction.description);
    
    if (!categoryTotals[category]) {
      categoryTotals[category] = { total: 0, count: 0 };
    }
    
    categoryTotals[category].total += Math.abs(transaction.amount);
    categoryTotals[category].count += 1;
  }); */

    useEffect(() => {
      const processTransactions = async () => {
        setLoading(true);
    
        // Group transactions by category using AI
        const categoryTotals: { [key: string]: { total: number; count: number } } = {};
        const transactionCategoryMap: { [category: string]: Transaction[] } = {};
      
        // Process transactions with hybrid approach using keywords first, then AI
        const descriptions = outgoingTransactions.map(t => t.description);
        const categories = await aiService.categorizeTransactionsHybrid(descriptions, user?.uid || '');
      
        // Group transactions by their AI-determined categories
        outgoingTransactions.forEach((transaction, index) => {
          const category = categories[index];
      
          if (!categoryTotals[category]) {
            categoryTotals[category] = { total: 0, count: 0 };
            transactionCategoryMap[category] = [];
          }
      
          categoryTotals[category].total += Math.abs(transaction.amount);
          categoryTotals[category].count += 1;

          // Store the transaction in the mapping
          transactionCategoryMap[category].push(transaction);
        });
      
        // Calculate total spending and convert to array
        const totalSpending = Object.values(categoryTotals).reduce(
          (sum, category) => sum + category.total, 0
        );
      
        // Convert to array and sort
        const processedData: CategoryData[] = Object.entries(categoryTotals)
          .map(([name, data]) => ({
            name,
            total: data.total,
            count: data.count,
            percentage: totalSpending > 0 ? (data.total / totalSpending) * 100 : 0,
          }))
          .sort((a, b) => b.total - a.total);
    
        setCategoryData(processedData);
        setTransactionsByCategory(transactionCategoryMap);
        setLoading(false);
      };

      if (outgoingTransactions.length > 0) {
        processTransactions();
      } else {
        setCategoryData([]);
        setTransactionsByCategory({});
        setLoading(false);
      }
    }, [transactions]);

      // Add navigation handler
  const handleCategoryPress = (categoryItem: CategoryData) => {
    const categoryTransactions = transactionsByCategory[categoryItem.name] || [];
    
    navigation.navigate('CategoryTransactions', {
      categoryName: categoryItem.name,
      transactions: categoryTransactions,
      currency: currency || 'GBP',
    });
  };

 // Simple loading state
  if (loading) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Categorizing transactions...</Text>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );
}

  // Calculate total spending for display
  const totalSpending = categoryData.reduce((sum, category) => sum + category.total, 0);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };
  
  // Display individual category
  const renderCategoryItem = ({ item }: { item: CategoryData }) => (
  <TouchableOpacity 
      style={styles.categoryItem}
      onPress={() => handleCategoryPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>{item.name}</Text>
        <Text style={styles.categoryDetails}>
          {item.count} transaction{item.count !== 1 ? 's' : ''} • {item.percentage.toFixed(1)}%
        </Text>
      </View>
      <Text style={styles.categoryAmount}>{formatCurrency(item.total)}</Text>
    </TouchableOpacity>
  );
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>This Month's Spending ({moment().format('MMMM YYYY')})</Text>
      
      {outgoingTransactions.length > 0 ? (
        <>
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total Spending</Text>
            <Text style={styles.totalAmount}>{formatCurrency(totalSpending)}</Text>
            <Text style={styles.transactionCount}>
              {outgoingTransactions.length} transactions this month
            </Text>
          </View>
          
          <FlatList
            data={categoryData}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.name}
            style={styles.categoryList}
            scrollEnabled={false}
          />
        </>
      ) : (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>
            No spending data for {moment().format('MMMM YYYY')}.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 15,
  },
  totalContainer: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  totalLabel: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 5,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  transactionCount: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 5,
  },
  categoryList: {
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 2,
  },
  categoryDetails: {
    fontSize: 12,
    color: COLORS.gray,
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: 10,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    color: COLORS.gray,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default SpendingCategoryChart;