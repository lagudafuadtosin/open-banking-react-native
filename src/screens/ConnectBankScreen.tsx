import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { trueLayerService } from '../services/trueLayerService';
import { showErrorAlert, logError } from '../utils/errorHandling';

type ConnectBankScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ConnectBank'>;

interface ConnectBankScreenProps {
  navigation: ConnectBankScreenNavigationProp;
}

const DEFAULT_BANK_ICON = require('../../assets/banks/logo.png')

const banks = [
  { id: 'hsbc', name: 'HSBC', logo: DEFAULT_BANK_ICON },
  { id: 'barclays', name: 'Barclays', logo: DEFAULT_BANK_ICON },
  { id: 'lloyds', name: 'Lloyds', logo: DEFAULT_BANK_ICON },
  { id: 'santander', name: 'Santander', logo: DEFAULT_BANK_ICON },
  { id: 'nationwide', name: 'Nationwide', logo: DEFAULT_BANK_ICON },
  { id: 'natwest', name: 'NatWest', logo: DEFAULT_BANK_ICON },
];

const ConnectBankScreen: React.FC<ConnectBankScreenProps> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    navigation.setOptions({
      title: 'Connect Bank',
      headerLeft: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.headerButtonText}>Back</Text>
        </TouchableOpacity>
      ),
    });
    trueLayerService.initSDK();
  }, [navigation]);
  
  const handleConnectBank = async () => {
    try {
      setIsLoading(true);
      await trueLayerService.connectBank();
      Alert.alert('Success', 'Bank connected successfully', [
        { text: 'OK', onPress: () => navigation.navigate('Dashboard') }
      ]);
    } catch (error: any) {
      showErrorAlert('Connection Failed', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect Your Bank</Text>
      <Text style={styles.subtitle}>
        Securely connect your bank accounts to use all features of the app
      </Text>
      
      <ScrollView style={styles.banksContainer}>
        <Text style={styles.sectionTitle}>Supported Banks</Text>
        
        <View style={styles.bankGrid}>
          {banks.map((bank) => (
            <TouchableOpacity 
              key={bank.id} 
              style={styles.bankCard}
              onPress={handleConnectBank}
            >
              <Image source={bank.logo} style={styles.bankLogo} />
              <Text style={styles.bankName}>{bank.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <Text style={styles.securityNote}>
          Your banking credentials are never stored in this app.
          We use TrueLayer's secure Open Banking APIs which are FCA regulated.
        </Text>
      </ScrollView>
      
      <TouchableOpacity 
        style={styles.connectButton}
        onPress={handleConnectBank}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.connectButtonText}>Connect a Bank</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  headerButton: {
    marginLeft: 15,
  },
  headerButtonText: {
    color: '#1a73e8',
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1a73e8',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: '#5f6368',
  },
  banksContainer: {
    flex: 1,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#202124',
  },
  bankGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bankCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  bankLogo: {
    width: 60,
    height: 60,
    marginBottom: 10,
    resizeMode: 'contain',
  },
  bankName: {
    fontSize: 12,
    color: '#5f6368',
  },
  securityNote: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 12,
    color: '#5f6368',
    paddingHorizontal: 15,
  },
  connectButton: {
    backgroundColor: '#1a73e8',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ConnectBankScreen;