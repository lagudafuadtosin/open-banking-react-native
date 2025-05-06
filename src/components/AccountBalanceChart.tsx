import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Balance } from '../services/trueLayerService';

interface AccountBalanceChartProps {
  balanceHistory: Balance[];
  currency: string;
}

const AccountBalanceChart: React.FC<AccountBalanceChartProps> = ({ 
  balanceHistory, 
  currency 
}) => {
  // Format dates and values for the chart
  const labels = balanceHistory.map(b => 
    new Date(b.last_updated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  );
  
  const data = balanceHistory.map(b => b.available ?? 0); // Fallback to 0 if undefined
  
  // Calculate min/max for better display
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
  
  // Modified formatYLabel to accept string and convert to number
  const formatYLabel = (yLabel: string) => {
    const value = parseFloat(yLabel);
    return formatCurrency(value);
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Balance History</Text>
      {balanceHistory.length > 1 ? (
        <LineChart
          data={{
            labels,
            datasets: [
              {
                data,
                color: (opacity = 1) => `rgba(26, 115, 232, ${opacity})`,
                strokeWidth: 2,
              },
            ],
          }}
          width={Dimensions.get('window').width - 40}
          height={220}
          yAxisLabel=""
          yAxisSuffix=""
          yAxisInterval={1}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(26, 115, 232, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(95, 99, 104, ${opacity})`,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: '#1a73e8',
            },
            formatYLabel: formatYLabel,
          }}
          bezier
          style={styles.chart}
        />
      ) : (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>
            Not enough data to display balance history.
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
  chart: {
    marginLeft: -15,
    borderRadius: 10,
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

export default AccountBalanceChart;