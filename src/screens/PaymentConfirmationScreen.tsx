import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { trueLayerService, PaymentStatus } from '../services/trueLayerService';
import Icon from 'react-native-vector-icons/MaterialIcons';

type PaymentConfirmationScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PaymentConfirmation'
>;
type PaymentConfirmationScreenRouteProp = RouteProp<
  RootStackParamList,
  'PaymentConfirmation'
>;

interface PaymentConfirmationScreenProps {
  navigation: PaymentConfirmationScreenNavigationProp;
  route: PaymentConfirmationScreenRouteProp;
}

const PaymentConfirmationScreen: React.FC<PaymentConfirmationScreenProps> = ({
  navigation,
  route,
}) => {
  const { paymentId, resourceToken, amount, recipient } = route.params;
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkPaymentStatus = async () => {
    try {
      const status = await trueLayerService.getPaymentStatus(paymentId, resourceToken);
      setPaymentStatus(status);
    } catch (error: any) {
      console.error('Error checking payment status:', error);
      Alert.alert('Error', 'Failed to check payment status. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkPaymentStatus();
    const interval = setInterval(checkPaymentStatus, 5000);
    return () => clearInterval(interval);
  }, [paymentId, resourceToken]);

  const getStatusIcon = () => {
    if (!paymentStatus) return null;
    switch (paymentStatus.status) {
      case 'Settled':
        return <Icon name="check-circle" size={60} color="#34a853" />;
      case 'Failed':
        return <Icon name="error" size={60} color="#ea4335" />;
      default:
        return <ActivityIndicator size="large" color="#1a73e8" />;
    }
  };

  const getStatusMessage = () => {
    if (!paymentStatus) return 'Checking payment status...';
    switch (paymentStatus.status) {
      case 'Settled':
        return 'Payment Successful!';
      case 'Failed':
        return 'Payment Failed';
      case 'Initiated':
        return 'Payment Initiated...';
      case 'AuthorizationRequired':
        return 'Authorization Required';
      default:
        return 'Processing Payment...';
    }
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator size="large" color="#1a73e8" />
      ) : (
        <>
          <View style={styles.statusContainer}>{getStatusIcon()}</View>
          <Text style={styles.statusMessage}>{getStatusMessage()}</Text>

          <View style={styles.detailsContainer}>
            <Text style={styles.detailLabel}>Recipient</Text>
            <Text style={styles.detailValue}>{recipient.name}</Text>

            <Text style={styles.detailLabel}>Amount</Text>
            <Text style={styles.detailValue}>
              {new Intl.NumberFormat('en-GB', {
                style: 'currency',
                currency: 'GBP',
              }).format(amount)}
            </Text>

            <Text style={styles.detailLabel}>Payment ID</Text>
            <Text style={styles.detailValue}>{paymentId}</Text>
          </View>

          {paymentStatus?.status === 'Settled' && (
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => navigation.navigate('Dashboard')}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          )}

          {paymentStatus?.status === 'Failed' && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  statusContainer: {
    marginBottom: 20,
  },
  statusMessage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#202124',
    marginBottom: 30,
  },
  detailsContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailLabel: {
    fontSize: 14,
    color: '#5f6368',
    marginBottom: 5,
  },
  detailValue: {
    fontSize: 16,
    color: '#202124',
    marginBottom: 15,
  },
  doneButton: {
    backgroundColor: '#1a73e8',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 30,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: '#ea4335',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 30,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PaymentConfirmationScreen;