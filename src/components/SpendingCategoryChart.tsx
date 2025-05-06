import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { Transaction } from '../services/trueLayerService';

interface SpendingCategoryChartProps {
  transactions: Transaction[];
  currency: string;
}

interface CategoryTotal {
  name: string;
  total: number;
  color: string;
  legendFontColor: string;
  legendFontSize: number;
}

const SpendingCategoryChart: React.FC<SpendingCategoryChartProps> = ({ 
  transactions, 
  currency 
}) => {
  // Only include outgoing transactions (negative amounts)
  const outgoingTransactions = transactions.filter(t => t.amount < 0);
  
  // Group by category and calculate totals
  const categoryTotals: { [key: string]: number } = {};
  outgoingTransactions.forEach(transaction => {
    const category = transaction.transaction_category || 'Uncategorized';
    if (!categoryTotals[category]) {
      categoryTotals[category] = 0;
    }
    categoryTotals[category] += Math.abs(transaction.amount);
  });
  
  // Color palette for the chart
  const colors = [
    '#1a73e8', '#4285f4', '#5e97f6', '#7baaf7', '#a1c2fa', 
    '#34a853', '#4caf50', '#7cb342', '#8bc34a', '#9ccc65',
    '#fbbc04', '#ffc107', '#ffca28', '#ffd54f', '#ffe082',
    '#ea4335', '#f44336', '#ef5350', '#e57373', '#ef9a9a',
  ];
  
  // Prepare data for the pie chart
  const pieData: CategoryTotal[] = Object.entries(categoryTotals)
    .map(([category, total], index) => ({
      name: category,
      total,
      color: colors[index % colors.length],
      legendFontColor: '#5f6368',
      legendFontSize: 12,
    }))
    .sort((a, b) => b.total - a.total) // Sort by highest amount first
    .slice(0, 8); // Limit to top 8 categories
  
  // Calculate total spending
  const totalSpending = Object.values(categoryTotals).reduce(
    (sum, value) => sum + value, 0
  );
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
    }).format(value);
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spending by Category</Text>
      {outgoingTransactions.length > 0 ? (
        <>
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total Spending</Text>
            <Text style={styles.totalAmount}>{formatCurrency(totalSpending)}</Text>
          </View>
          
          <PieChart
            data={pieData}
            width={Dimensions.get('window').width - 40}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            }}
            accessor="total"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </>
      ) : (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>
            No spending data to display.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#202124',
    marginBottom: 15,
  },
  totalContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  totalLabel: {
    fontSize: 14,
    color: '#5f6368',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#202124',
  },
  noDataContainer: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    color: '#5f6368',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default SpendingCategoryChart;