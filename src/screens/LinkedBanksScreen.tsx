import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { syncService } from '../services/syncService';
import Icon from 'react-native-vector-icons/MaterialIcons';

type LinkedBanksScreenNavigationProp = StackNavigationProp<RootStackParamList, 'LinkedBanks'>;

interface LinkedBanksScreenProps {
  navigation: LinkedBanksScreenNavigationProp;
}

interface BankInfo {
  name: string;
  accountCount: number;
  bankId: string;
}

const LinkedBanksScreen: React.FC<LinkedBanksScreenProps> = ({ navigation }) => {
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState<string | null>(null);

  const loadLinkedBanks = async () => {
    try {
      setIsLoading(true);
      const accounts = await syncService.getAccounts();

      const bankMap: { [key: string]: BankInfo } = {};
      accounts.forEach(account => {
        const bankId = account.institution_id || 'unknown'; // Updated to institution_id
        if (!bankMap[bankId]) {
          bankMap[bankId] = {
            name: account.institution_name || 'Unknown Bank', // Updated to institution_name
            accountCount: 0,
            bankId,
          };
        }
        bankMap[bankId].accountCount += 1;
      });

      setBanks(Object.values(bankMap));
    } catch (error: any) {
      console.error('Error loading linked banks:', error);
      Alert.alert('Error', 'Failed to load linked banks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLinkedBanks();
  }, []);

  const handleDisconnect = async (bankId: string) => {
    Alert.alert(
      'Disconnect Bank',
      'Are you sure you want to disconnect this bank? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDisconnecting(bankId);
              await syncService.disconnectBank(bankId);
              setBanks(banks.filter(bank => bank.bankId !== bankId));
              Alert.alert('Success', 'Bank disconnected successfully.');
            } catch (error: any) {
              console.error('Error disconnecting bank:', error);
              Alert.alert('Error', 'Failed to disconnect bank. Please try again.');
            } finally {
              setIsDisconnecting(null);
            }
          },
        },
      ]
    );
  };

  const renderBankItem = ({ item }: { item: BankInfo }) => (
    <View style={styles.bankItem}>
      <View style={styles.bankInfo}>
        <View style={styles.bankLogoPlaceholder}>
          <Text style={styles.bankLogoText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.bankName}>{item.name}</Text>
          <Text style={styles.accountCount}>
            {item.accountCount} linked account{item.accountCount > 1 ? 's' : ''}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.disconnectButton}
        onPress={() => handleDisconnect(item.bankId)}
        disabled={isDisconnecting === item.bankId}
      >
        {isDisconnecting === item.bankId ? (
          <ActivityIndicator color="#ea4335" size="small" />
        ) : (
          <Text style={styles.disconnectButtonText}>Disconnect</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading linked banks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {banks.length > 0 ? (
        <FlatList
          data={banks}
          renderItem={renderBankItem}
          keyExtractor={item => item.bankId}
          contentContainerStyle={styles.bankList}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No linked banks found.</Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.addBankButton}
        onPress={() => navigation.navigate('BankAuth')}
      >
        <Icon name="add" size={20} color="#fff" style={styles.addBankIcon} />
        <Text style={styles.addBankButtonText}>Link New Bank</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#5f6368',
    fontSize: 16,
  },
  bankList: {
    padding: 15,
  },
  bankItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  bankLogoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  bankName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#202124',
  },
  accountCount: {
    fontSize: 14,
    color: '#5f6368',
  },
  disconnectButton: {
    backgroundColor: '#ea4335',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  disconnectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#5f6368',
  },
  addBankButton: {
    flexDirection: 'row',
    backgroundColor: '#1a73e8',
    padding: 15,
    margin: 15,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBankIcon: {
    marginRight: 10,
  },
  addBankButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LinkedBanksScreen;