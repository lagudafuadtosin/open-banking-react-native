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
import COLORS from '../constants/colors';
import { SessionTimeoutWrapper } from '../hooks/SessionTimeoutWrapper';

type ConnectBankScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ConnectBank'>;

interface ConnectBankScreenProps {
  navigation: ConnectBankScreenNavigationProp;
  route: any; // To make user go to connect bank at dashboard
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

const ConnectBankScreen: React.FC<ConnectBankScreenProps> = ({ navigation, route }) => {
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
        
        // Check if we're returning from BankAuthScreen (not just browsing to ConnectBank)
        const wasFromAuth = route.params?.fromAuth || false;
        
        if (token && wasFromAuth) { // Only navigate if returning from successful auth
          console.log('Token detected after BankAuthScreen, navigating to Dashboard');
          navigation.replace('Dashboard');
        } else {
          console.log('No token found after retries');
        }
        // if (token) {
        //   console.log('Token detected after BankAuthScreen, navigating to Dashboard');
        //   navigation.replace('Dashboard'); // Commented out - was auto-redirecting for any existing token
        // } else {
        //   console.log('No token found after retries');
        // }
      } catch (error) {
        logError('ConnectBankScreen.checkTokenAndNavigate', error);
      }
    };

    const unsubscribe = navigation.addListener('focus', checkTokenAndNavigate);
    return unsubscribe;
  }, [navigation, route]);

  const handleConnectBank = async (bankId: string, bankName: string) => {
    if (!user) {
      Alert.alert('Error', 'You need to be logged in to connect a bank.');
      return;
    }

    try {
      setIsLoading(true);
      setConnectingBank(bankId);

      console.log(`Starting connection process for ${bankName} (${bankId})`);

      // Get authentication URL - force all banks to use mock in sandbox (did not think this was necessary)
      const { success, redirectUrl } = await trueLayerService.startBankAuth('mock'); // Force mock for all banks in sandbox

      if (success && redirectUrl) {
        console.log('Bank auth started successfully, navigating to auth screen');
        navigation.navigate('BankAuth', { bankId: 'mock', bankName }); // Pass mock as bankId but keep original bankName for display
      } else {
        throw new Error('Failed to get authentication URL');
      }
    } catch (error: any) {
      logError('ConnectBankScreen.handleConnectBank', error);
      Alert.alert('Connection Failed', 'Unable to connect to bank. Please try again.');
    } finally {
      setIsLoading(false);
      setConnectingBank(null);
    }
  };

  if (!initializeComplete) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Initializing banking connection...</Text>
      </View>
    );
  }

  return (
    <SessionTimeoutWrapper>
    <View style={styles.container}>
      <Text style={styles.title}>Connect Your Bank</Text>
      <Text style={styles.subtitle}>
        
      </Text>

      <ScrollView style={styles.banksContainer}>
        <Text style={styles.sectionTitle}>Banks</Text>

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
                <ActivityIndicator size="small" color={COLORS.primary} style={styles.bankLoading} />
              ) : (
                <Image source={bank.logo} style={styles.bankLogo} />
              )}
              <Text style={styles.bankName}>{bank.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        
      </ScrollView>

      <TouchableOpacity
        style={styles.connectButton}
        onPress={() => handleConnectBank('mock', 'Mock Bank (Sandbox)')} // Default to Mock Bank
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.connectButtonText}>Connect Mock Bank (Sandbox)</Text>
        )}
      </TouchableOpacity>
    </View>
    </SessionTimeoutWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: COLORS.lightGray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.gray,
    fontSize: 16,
  },
  headerButton: {
    marginLeft: 15,
  },
  headerButtonText: {
    color: COLORS.primary,
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    color: COLORS.gray,
  },
  banksContainer: {
    flex: 1,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: COLORS.text,
  },
  bankGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bankCard: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  bankCardSelected: {
    borderColor: COLORS.primary,
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
    color: COLORS.gray,
    textAlign: 'center',
  },
  securityNote: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.gray,
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
    color: COLORS.primary,
    marginBottom: 10,
  },
  helpText: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 8,
  },
  connectButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  connectButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ConnectBankScreen;