import React, { useState, useEffect, useContext } from 'react';
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
import { AuthContext } from '../context/AuthContext';

type ConnectBankScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ConnectBank'>;

interface ConnectBankScreenProps {
  navigation: ConnectBankScreenNavigationProp;
}

const DEFAULT_BANK_ICON = require('../../assets/banks/logo.png');

const banks = [
  { id: 'mock', name: 'Mock Bank (Sandbox)', logo: DEFAULT_BANK_ICON },
  { id: 'hsbc', name: 'HSBC', logo: DEFAULT_BANK_ICON },
  { id: 'barclays', name: 'Barclays', logo: DEFAULT_BANK_ICON },
  { id: 'lloyds', name: 'Lloyds', logo: DEFAULT_BANK_ICON },
  { id: 'santander', name: 'Santander', logo: DEFAULT_BANK_ICON },
  { id: 'nationwide', name: 'Nationwide', logo: DEFAULT_BANK_ICON },
  { id: 'natwest', name: 'NatWest', logo: DEFAULT_BANK_ICON },
];

const ConnectBankScreen: React.FC<ConnectBankScreenProps> = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(false);
  const [connectingBank, setConnectingBank] = useState<string | null>(null);
  const [initializeComplete, setInitializeComplete] = useState(false);

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

    // Initialize TrueLayer SDK
    const initializeSDK = async () => {
      try {
        await trueLayerService.initSDK();
        setInitializeComplete(true);
      } catch (error) {
        logError('ConnectBankScreen.initializeSDK', error);
        showErrorAlert('Initialization Failed', 'Failed to initialize banking connection. Please try again.');
      }
    };

    initializeSDK();
  }, [navigation]);

  // Listen for return from BankAuthScreen and check token with retry
  useEffect(() => {
    const checkTokenAndNavigate = async () => {
      try {
        let token;
        // Retry token retrieval with a small delay if not found initially
        for (let i = 0; i < 3; i++) {
          token = await trueLayerService.getAccessToken();
          if (token) break;
          console.log(`Token not found, retrying (${i + 1}/3)...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        }

        if (token) {
          console.log('Token detected after BankAuthScreen, navigating to Dashboard');
          navigation.replace('Dashboard');
        } else {
          console.log('No token found after retries');
        }
      } catch (error) {
        console.error('Error checking token:', error);
        showErrorAlert('Navigation Error', 'Failed to verify bank connection. Please try again.');
      }
    };

    const unsubscribe = navigation.addListener('focus', checkTokenAndNavigate);
    return unsubscribe;
  }, [navigation]);

  const handleConnectBank = async (bankId: string, bankName: string) => {
    if (!user) {
      Alert.alert('Error', 'You need to be logged in to connect a bank.');
      return;
    }

    try {
      setIsLoading(true);
      setConnectingBank(bankId);

      console.log(`Starting connection process for ${bankName} (${bankId})`);

      // Get authentication URL
      const { success, redirectUrl } = await trueLayerService.startBankAuth();

      if (success && redirectUrl) {
        console.log('Bank auth started successfully, navigating to auth screen');
        navigation.navigate('BankAuth', { bankId, bankName });
      } else {
        throw new Error('Failed to get authentication URL');
      }
    } catch (error: any) {
      logError('ConnectBankScreen.handleConnectBank', error);
      showErrorAlert('Connection Failed', error);
    } finally {
      setIsLoading(false);
      setConnectingBank(null);
    }
  };

  if (!initializeComplete) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Initializing banking connection...</Text>
      </View>
    );
  }

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
              style={[
                styles.bankCard,
                connectingBank === bank.id && styles.bankCardSelected
              ]}
              onPress={() => handleConnectBank(bank.id, bank.name)}
              disabled={isLoading}
            >
              {connectingBank === bank.id ? (
                <ActivityIndicator size="small" color="#1a73e8" style={styles.bankLoading} />
              ) : (
                <Image source={bank.logo} style={styles.bankLogo} />
              )}
              <Text style={styles.bankName}>{bank.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.securityNote}>
          Your banking credentials are never stored in this app.
          We use TrueLayer's secure Open Banking APIs which are FCA regulated.
        </Text>

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>How to connect:</Text>
          <Text style={styles.helpText}>1. Select your bank from the list above</Text>
          <Text style={styles.helpText}>2. Log in with your existing online banking credentials</Text>
          <Text style={styles.helpText}>3. Authorize access to your account information</Text>
          <Text style={styles.helpText}>4. You'll be redirected back to the app</Text>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.connectButton}
        onPress={() => handleConnectBank('mock', 'Mock Bank (Sandbox)')} // Default to Mock Bank
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.connectButtonText}>Connect Mock Bank (Sandbox)</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    color: '#5f6368',
    fontSize: 16,
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
  bankCardSelected: {
    borderColor: '#1a73e8',
    borderWidth: 2,
  },
  bankLogo: {
    width: 60,
    height: 60,
    marginBottom: 10,
    resizeMode: 'contain',
  },
  bankLoading: {
    width: 60,
    height: 60,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bankName: {
    fontSize: 12,
    color: '#5f6368',
    textAlign: 'center',
  },
  securityNote: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 12,
    color: '#5f6368',
    paddingHorizontal: 15,
  },
  helpSection: {
    marginTop: 30,
    backgroundColor: '#e8f0fe',
    padding: 15,
    borderRadius: 10,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a73e8',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 14,
    color: '#202124',
    marginBottom: 8,
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