import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking, // Added for opening HPP URL (mlved to truelayerservice, leave for now)
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { Picker } from '@react-native-picker/picker';
import { syncService } from '../services/syncService';
import { trueLayerService, BankAccount, Balance } from '../services/trueLayerService';
import COLORS from '../constants/colors';
import { SessionTimeoutWrapper } from '../hooks/SessionTimeoutWrapper';
import { logError } from '../utils/errorHandling';
import { useAuth } from '../context/AuthContext';
import { TRUELAYER_REDIRECT_URI } from '@env';

type PaymentScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Payment'>;

interface PaymentScreenProps {
  navigation: PaymentScreenNavigationProp;
}

interface AccountWithBalance extends BankAccount {
  balance: Balance | null;
}

interface Recipient {
  name: string;
  accountNumber: string;
  sortCode: string;
}

interface ValidationErrors {
  recipientName?: string;
  accountNumber?: string;
  sortCode?: string;
  amount?: string;
}

const PaymentScreen: React.FC<PaymentScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<Recipient>({
    name: '',
    accountNumber: '',
    sortCode: '',
  });
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const loadAccounts = async () => {
    try {
      const accountsData = await syncService.getAccounts();
      setAccounts(accountsData);
      
      if (accountsData.length > 0) {
        setSelectedAccountId(accountsData[0].account_id);
      }
    } catch (error: any) {
      logError('PaymentScreen.loadAccounts', error);
      Alert.alert('Error', 'Failed to load your accounts. Please try again.');
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // Format sort code with hyphens
  const formatSortCode = (value: string) => {
    // Remove all non-numeric characters
    const numericOnly = value.replace(/[^0-9]/g, '');
    
    // Limit to 6 digits
    const limited = numericOnly.substring(0, 6);
    
    // Add hyphens: 12 -> 12, 1234 -> 12-34, 123456 -> 12-34-56
    if (limited.length <= 2) {
      return limited;
    } else if (limited.length <= 4) {
      return `${limited.substring(0, 2)}-${limited.substring(2)}`;
    } else {
      return `${limited.substring(0, 2)}-${limited.substring(2, 4)}-${limited.substring(4)}`;
    }
  };

  // Format amount with £ symbol
  const formatAmount = (value: string) => {
    // Remove everything except numbers and decimal point
    const numericOnly = value.replace(/[^0-9.]/g, '');
    
    // Ensure only one decimal point
    const parts = numericOnly.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    return numericOnly;
  };

  // Validation functions
  const validateRecipientName = (name: string): string | undefined => {
    if (!name.trim()) {
      return 'Recipient name is required';
    }
    if (name.trim().length < 2) {
      return 'Name must be at least 2 characters';
    }
    if (!/^[a-zA-Z\s'-]+$/.test(name.trim())) {
      return 'Name can only contain letters, spaces, hyphens and apostrophes';
    }
    return undefined;
  };

  const validateAccountNumber = (accountNumber: string): string | undefined => {
    if (!accountNumber) {
      return 'Account number is required';
    }
    if (!/^\d{8}$/.test(accountNumber)) {
      return 'Account number must be exactly 8 digits';
    }
    return undefined;
  };

  const validateSortCode = (sortCode: string): string | undefined => {
    if (!sortCode) {
      return 'Sort code is required';
    }
    // Remove hyphens for validation
    const numbersOnly = sortCode.replace(/-/g, '');
    if (!/^\d{6}$/.test(numbersOnly)) {
      return 'Sort code must be exactly 6 digits';
    }
    return undefined;
  };

  const validateAmount = (amount: string): string | undefined => {
    if (!amount) {
      return 'Amount is required';
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return 'Amount must be a positive number';
    }
    if (numAmount > 10000) {
      return 'Amount cannot exceed £10,000';
    }
    if (numAmount < 0.01) {
      return 'Minimum amount is £0.01';
    }
    
    // Check if user has sufficient funds
    const account = accounts.find(acc => acc.account_id === selectedAccountId);
    if (account?.balance?.available && numAmount > account.balance.available) {
      return 'Insufficient funds in the selected account';
    }
    
    return undefined;
  };

  // Real-time validation
  const validateField = (field: keyof ValidationErrors, value: string) => {
    let error: string | undefined;
    
    switch (field) {
      case 'recipientName':
        error = validateRecipientName(value);
        break;
      case 'accountNumber':
        error = validateAccountNumber(value);
        break;
      case 'sortCode':
        error = validateSortCode(value);
        break;
      case 'amount':
        error = validateAmount(value);
        break;
    }
    
    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };

  const validateAllFields = (): boolean => {
    const newErrors: ValidationErrors = {
      recipientName: validateRecipientName(recipient.name),
      accountNumber: validateAccountNumber(recipient.accountNumber),
      sortCode: validateSortCode(recipient.sortCode),
      amount: validateAmount(amount),
    };
    
    setErrors(newErrors);
    
    // Check if any errors exist
    return !Object.values(newErrors).some(error => error !== undefined);
  };

  const handleRecipientNameChange = (text: string) => {
    setRecipient({ ...recipient, name: text });
    validateField('recipientName', text);
  };

  const handleAccountNumberChange = (text: string) => {
    // Only allow numbers, max 8 digits
    const numbersOnly = text.replace(/[^0-9]/g, '').substring(0, 8);
    setRecipient({ ...recipient, accountNumber: numbersOnly });
    validateField('accountNumber', numbersOnly);
  };

  const handleSortCodeChange = (text: string) => {
    const formatted = formatSortCode(text);
    setRecipient({ ...recipient, sortCode: formatted });
    validateField('sortCode', formatted);
  };

  const handleAmountChange = (text: string) => {
    const formatted = formatAmount(text);
    setAmount(formatted);
    validateField('amount', formatted);
  };

    const handlePayment = async () => {
        if (!selectedAccountId) {
          Alert.alert('Error', 'Please select an account');
          return;
        }

        // Validate all fields
        if (!validateAllFields()) {
          Alert.alert('Validation Error', 'Please fix the errors before proceeding');
          return;
        }

        try {
          setIsLoading(true);
        
          if (!user || !user.uid) {
            throw new Error('User not authenticated');
          }

          const paymentRequest = {
            amount: parseFloat(amount),
            currency: 'GBP',
            accountIdentifier: selectedAccountId,
            recipient: {
              name: recipient.name.trim(),
              account_number: recipient.accountNumber,
              sort_code: recipient.sortCode.replace(/-/g, ''), 
            },
            user: {
              id: user.uid,
              name: user.displayName || 'User',
              email: user.email || 'user@example.com',
            },
          };

          const { paymentId, authUrl, status, resourceToken } = await trueLayerService.initiatePayment(paymentRequest);
          console.log('Payment response:', { paymentId, authUrl, status, resourceToken });

          if (authUrl) {
            navigation.navigate('PaymentAuth', {
              paymentId,
              authUrl,
              amount: parseFloat(amount),
              recipient: { name: recipient.name.trim() },
            });
          } else if (status === 'authorization_required' && resourceToken) {
            const hppUrl = `https://payment.truelayer-sandbox.com/payments#payment_id=${paymentId}&resource_token=${resourceToken}&return_uri=${TRUELAYER_REDIRECT_URI}`;
            console.log('Navigating to PaymentAuth with HPP URL:', hppUrl);
            navigation.navigate('PaymentAuth', {
              paymentId,
              authUrl: hppUrl, // Pass HPP URL as authUrl to WebView
              amount: parseFloat(amount),
              recipient: { name: recipient.name.trim() },
            });
          } else {
            Alert.alert('Info', 'Authorization required. Please check the TrueLayer Console to authorize this payment.');
          }
        } catch (error: any) {
          logError('PaymentScreen.handlePayment', error);
          Alert.alert('Error', 'Failed to initiate payment. Please try again.');
        } finally {
          setIsLoading(false);
        }
      };

  const renderError = (error?: string) => {
    if (!error) return null;
    return <Text style={styles.errorText}>{error}</Text>;
  };

  return (
    <SessionTimeoutWrapper>
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Send Payment</Text>

      <View style={styles.formContainer}>
        <Text style={styles.label}>Select Account</Text>
          <View style={{
            borderWidth: 1,
            borderColor: '#E0E0E0',
            borderRadius: 8,
            marginBottom: 15,
            backgroundColor: '#FFFFFF',
          }}>
            <Picker
              selectedValue={selectedAccountId}
              onValueChange={(itemValue) => setSelectedAccountId(itemValue)}
              style={{ color: '#000000' }}
            >
              <Picker.Item 
                label="Select an account" 
                value="" 
                color="#000000"
              />
              {accounts.map((account) => (
                <Picker.Item
                  key={account.account_id}
                  label={`${account.display_name} - ${
                    account.balance?.available
                      ? new Intl.NumberFormat('en-GB', {
                          style: 'currency',
                          currency: account.balance.currency,
                        }).format(account.balance.available)
                      : 'N/A'
                  }`}
                  value={account.account_id}
                  color="#000000"
                />
              ))}
            </Picker>
        </View>

        <TextInput
          style={{
            height: 50,
            borderWidth: 1,
            borderColor: errors.recipientName ? '#FF3B30' : '#E0E0E0',
            borderRadius: 8,
            marginBottom: 5,
            paddingHorizontal: 15,
            backgroundColor: '#FFFFFF',
            color: '#000000',
            fontSize: 16,
          }}
          value={recipient.name}
          onChangeText={handleRecipientNameChange}
          placeholder="Enter recipient's full name"
          placeholderTextColor="#999999"
          autoCapitalize="words"
        />

        <TextInput
          style={{
            height: 50,
            borderWidth: 1,
            borderColor: errors.accountNumber ? '#FF3B30' : '#E0E0E0',
            borderRadius: 8,
            marginBottom: 5,
            paddingHorizontal: 15,
            backgroundColor: '#FFFFFF',
            color: '#000000',
            fontSize: 16,
          }}
          value={recipient.accountNumber}
          onChangeText={handleAccountNumberChange}
          placeholder="12345678"
          placeholderTextColor="#999999"
          keyboardType="numeric"
          maxLength={8}
        />

        <TextInput
          style={{
            height: 50,
            borderWidth: 1,
            borderColor: errors.sortCode ? '#FF3B30' : '#E0E0E0',
            borderRadius: 8,
            marginBottom: 5,
            paddingHorizontal: 15,
            backgroundColor: '#FFFFFF',
            color: '#000000',
            fontSize: 16,
          }}
          value={recipient.sortCode}
          onChangeText={handleSortCodeChange}
          placeholder="12-34-56"
          placeholderTextColor="#999999"
          keyboardType="numeric"
          maxLength={8}
        />

        <TextInput
          style={{
            flex: 1,
            height: 50,
            borderWidth: 1,
            borderColor: errors.amount ? '#FF3B30' : '#E0E0E0',
            borderRadius: 8,
            paddingHorizontal: 15,
            backgroundColor: '#FFFFFF',
            color: '#000000',
            fontSize: 16,
          }}
          value={amount}
          onChangeText={handleAmountChange}
          placeholder="0.00"
          placeholderTextColor="#999999"
          keyboardType="decimal-pad"
        />
        
        {renderError(errors.amount)}

        <TouchableOpacity
          style={[
            styles.payButton,
            (isLoading || Object.values(errors).some(error => error)) && styles.disabledButton
          ]}
          onPress={handlePayment}
          disabled={isLoading || Object.values(errors).some(error => error)}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.payButtonText}>Send Payment</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
    </SessionTimeoutWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: COLORS.primary,
  },
  formContainer: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 5,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginBottom: 5,
    paddingHorizontal: 15,
    backgroundColor: COLORS.white,
    fontSize: 16,
    color: '#000000',
    placeholderTextColor: '#999999',
    selectionColor: '#000000',
    underlineColorAndroid: 'transparent',
  },
  inputError: {
    borderColor: COLORS.error,
    borderWidth: 2,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginBottom: 15,
    marginLeft: 5,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: COLORS.white,
  },
  picker: {
    height: 50,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginRight: 5,
  },
  amountInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: COLORS.white,
    fontSize: 16,
    color: '#000000',
    textColor: '#000000',
  },
  payButton: {
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    backgroundColor: COLORS.secondary,
    opacity: 0.6,
  },
  payButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PaymentScreen;