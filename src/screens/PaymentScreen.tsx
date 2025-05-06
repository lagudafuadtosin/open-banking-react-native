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
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { Picker } from '@react-native-picker/picker';
import { syncService } from '../services/syncService';
import { trueLayerService, BankAccount, Balance } from '../services/trueLayerService';

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

const PaymentScreen: React.FC<PaymentScreenProps> = ({ navigation }) => {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<Recipient>({
    name: '',
    accountNumber: '',
    sortCode: '',
  });
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadAccounts = async () => {
    try {
      const accountsData = await syncService.getAccounts();
      setAccounts(accountsData);
      
      if (accountsData.length > 0) {
        setSelectedAccountId(accountsData[0].account_id);
      }
    } catch (error: any) {
      console.error('Error loading accounts:', error);
      Alert.alert('Error', 'Failed to load your accounts. Please try again.');
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const validateInputs = () => {
    if (!selectedAccountId) {
      Alert.alert('Error', 'Please select an account');
      return false;
    }

    if (!recipient.name || !recipient.accountNumber || !recipient.sortCode) {
      Alert.alert('Error', 'Please fill in all recipient details');
      return false;
    }

    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return false;
    }

    const account = accounts.find(acc => acc.account_id === selectedAccountId);
    if (account?.balance?.available && amountNum > account.balance.available) {
      Alert.alert('Error', 'Insufficient funds in the selected account');
      return false;
    }

    return true;
  };

  const handlePayment = async () => {
    if (!validateInputs()) return;

    try {
      setIsLoading(true);
      const paymentRequest = {
        amount: parseFloat(amount),
        currency: 'GBP',
        recipient: {
          name: recipient.name,
          account_number: recipient.accountNumber,
          sort_code: recipient.sortCode,
        },
        accountId: selectedAccountId!,
      };

      const { paymentId, resourceToken } = await trueLayerService.initiatePayment(paymentRequest);

      navigation.navigate('PaymentConfirmation', {
        paymentId,
        resourceToken,
        amount: parseFloat(amount),
        recipient: { name: recipient.name },
      });
    } catch (error: any) {
      console.error('Error initiating payment:', error);
      Alert.alert('Error', 'Failed to initiate payment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Send Payment</Text>

      <View style={styles.formContainer}>
        <Text style={styles.label}>Select Account</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedAccountId}
            onValueChange={(itemValue) => setSelectedAccountId(itemValue)}
            style={styles.picker}
          >
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
              />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Recipient Name</Text>
        <TextInput
          style={styles.input}
          value={recipient.name}
          onChangeText={(text) => setRecipient({ ...recipient, name: text })}
          placeholder="Enter recipient's name"
        />

        <Text style={styles.label}>Account Number</Text>
        <TextInput
          style={styles.input}
          value={recipient.accountNumber}
          onChangeText={(text) => setRecipient({ ...recipient, accountNumber: text })}
          placeholder="Enter account number"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Sort Code</Text>
        <TextInput
          style={styles.input}
          value={recipient.sortCode}
          onChangeText={(text) => setRecipient({ ...recipient, sortCode: text })}
          placeholder="Enter sort code (e.g., 12-34-56)"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="Enter amount"
          keyboardType="numeric"
        />

        <TouchableOpacity
          style={styles.payButton}
          onPress={handlePayment}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.payButtonText}>Send Payment</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#1a73e8',
  },
  formContainer: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#202124',
    marginBottom: 5,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    backgroundColor: '#fff',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  payButton: {
    backgroundColor: '#1a73e8',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PaymentScreen;