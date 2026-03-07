import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import moment from 'moment';
import COLORS from '../constants/colors';

interface DailyBalance {
  date: string;
  balance: number;
  currency: string;
}

interface AccountBalanceChartProps {
  balanceHistory: DailyBalance[];
  currency: string;
}

const AccountBalanceChart: React.FC<AccountBalanceChartProps> = ({ 
  balanceHistory, 
  currency 
}) => {
  
  // When no balance data is available
  if (!balanceHistory || balanceHistory.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Balance This Month</Text>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No balance data available for this month.</Text>
        </View>
      </View>
    );
  }
  
  // Prepare chart data - show every 5th day to avoid crowding
  const labels = balanceHistory
    .filter((_, index) => index % 5 === 0 || index === balanceHistory.length - 1)
    .map(item => moment(item.date).format('DD'));
  
  const data = balanceHistory.map(item => item.balance);
  const minValue = Math.min(...data) * 0.95;
  const maxValue = Math.max(...data) * 1.05;
  
  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  // Calculate percentage for summary
  const currentBalance = balanceHistory[balanceHistory.length - 1]?.balance || 0;
  const startBalance = balanceHistory[0]?.balance || 0;
  const change = currentBalance - startBalance;
  const changePercent = startBalance > 0 ? ((change / startBalance) * 100) : 0;
  
  // Display current balance
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Balance This Month</Text>
      
      <View style={styles.summaryContainer}>
        <View style={styles.balanceRow}>
          <Text style={styles.currentBalanceLabel}>Current Balance</Text>
          <Text style={styles.currentBalance}>{formatCurrency(currentBalance)}</Text>
        </View>
        
        <View style={styles.changeRow}>
          <Text style={styles.changeLabel}>This Month</Text>
          <Text style={[
            styles.changeAmount, 
            change >= 0 ? styles.positiveChange : styles.negativeChange
          ]}>
            {change >= 0 ? '+' : ''}{formatCurrency(change)} ({changePercent.toFixed(1)}%)
          </Text>
        </View>
      </View>
      
      {balanceHistory.length > 1 ? (
          <LineChart
            data={{
              labels,
              datasets: [
                {
                  data,
                  color: (opacity = 1) => `rgba(106, 13, 173, ${opacity})`,
                  strokeWidth: 2,
                },
              ],
            }}
            width={Dimensions.get('window').width - 60}
            height={300}
            yAxisLabel=""
            yAxisSuffix=""
            segments={4}
            chartConfig={{
              backgroundColor: COLORS.white,
              backgroundGradientFrom: COLORS.white,
              backgroundGradientTo: COLORS.white,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(106, 13, 173, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(158, 158, 158, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: '3',
                strokeWidth: '1',
                stroke: COLORS.primary,
              },
              formatYLabel: (value: string) => {
                const numValue = parseFloat(value);
                if (numValue >= 1000) {
                  return `£${(numValue / 1000).toFixed(1)}k`;
                }
                return `£${numValue.toFixed(0)}`;
              },
              paddingTop: 20,
              paddingRight: 20,
            }}
            style={styles.chart}
            fromZero={false}
          />
      ) : (
        <View style={styles.noChartContainer}>
          <Text style={styles.noChartText}>Not enough data to display chart</Text>
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
  summaryContainer: {
    marginBottom: 15,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  currentBalanceLabel: {
    fontSize: 16,
    color: COLORS.gray,
  },
  currentBalance: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  changeAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  positiveChange: {
    color: COLORS.success,
  },
  negativeChange: {
    color: COLORS.error,
  },
  chart: {
    marginLeft: -15,
    borderRadius: 10,
    paddingRight: 20,
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
  noChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noChartText: {
    color: COLORS.gray,
    fontSize: 14,
    textAlign: 'center',
  },
});

export default AccountBalanceChart;