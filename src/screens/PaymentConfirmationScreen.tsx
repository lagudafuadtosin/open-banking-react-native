// Very basic, if needed improve

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
import COLORS from '../constants/colors';
import { SessionTimeoutWrapper } from '../hooks/SessionTimeoutWrapper';
import { logError } from '../utils/errorHandling';

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
  const { paymentId, amount, recipient } = route.params;
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkPaymentStatus = async () => {
    try {
      const status = await trueLayerService.getPaymentStatus(paymentId);
      setPaymentStatus(status);
    } catch (error: any) {
      logError('PaymentConfirmationScreen.checkPaymentStatus', error);
      Alert.alert('Error', 'Failed to check payment status. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkPaymentStatus();
    const interval = setInterval(checkPaymentStatus, 5000);
    return () => clearInterval(interval);
  }, [paymentId]);

  const getStatusIcon = () => {
    if (!paymentStatus) return null;
    switch (paymentStatus.status) {
      case 'executed':
      case 'settled':
        return <Icon name="check-circle" size={60} color={COLORS.success} />;
      case 'failed':
        return <Icon name="error" size={60} color={COLORS.error} />;
      default:
        return <ActivityIndicator size="large" color={COLORS.primary} />;
    }
  };

  const getStatusMessage = () => {
    if (!paymentStatus) return 'Checking payment status...';
    switch (paymentStatus.status) {
      case 'executed':
      case 'settled':
        return 'Payment Successful!';
      case 'failed':
        return 'Payment Failed';
      case 'authorization_required':
        return 'Authorization Required';
      default:
        return 'Processing Payment...';
    }
  };

  return (
    <SessionTimeoutWrapper>
      <View style={styles.container}>
        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
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

            {(paymentStatus?.status === 'executed' || paymentStatus?.status === 'settled') && (
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => navigation.navigate('Dashboard')}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            )}

            {paymentStatus?.status === 'failed' && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => navigation.navigate('Payment')}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </SessionTimeoutWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    padding: 20,
  },
  statusContainer: {
    marginBottom: 20,
  },
  statusMessage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 30,
  },
  detailsContainer: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 10,
    width: '100%',
    shadowColor: COLORS.black,
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
    color: COLORS.gray,
    marginBottom: 5,
  },
  detailValue: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 15,
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 30,
  },
  doneButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: COLORS.error,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 30,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PaymentConfirmationScreen;