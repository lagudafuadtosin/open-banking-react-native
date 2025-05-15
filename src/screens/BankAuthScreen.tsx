import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert, BackHandler, Text } from 'react-native';
import WebView from 'react-native-webview';
import { trueLayerService } from '../services/trueLayerService';
import { AuthContext } from '../context/AuthContext';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { TRUELAYER_REDIRECT_URI } from '@env';

type BankAuthScreenRouteProp = RouteProp<RootStackParamList, 'BankAuth'>;
type BankAuthScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BankAuth'>;

interface BankAuthScreenProps {
  route: BankAuthScreenRouteProp;
  navigation: BankAuthScreenNavigationProp;
}

const BankAuthScreen: React.FC<BankAuthScreenProps> = ({ route, navigation }) => {
  const { bankId, bankName } = route.params;
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingRedirect, setProcessingRedirect] = useState(false);
  const [showWebView, setShowWebView] = useState(true);
  const webViewRef = useRef<WebView | null>(null);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!processingRedirect) {
        navigation.goBack();
        return true;
      }
      return true; // Prevent going back during authentication
    });

    return () => backHandler.remove();
  }, [navigation, processingRedirect]);

  // Prepare the auth URL on component mount
  useEffect(() => {
    let isMounted = true;

    const prepareAuthUrl = async () => {
      try {
        if (!isMounted) return;

        setLoading(true);
        const { success, redirectUrl } = await trueLayerService.startBankAuth();

        if (!isMounted) return;

        if (success && redirectUrl) {
          console.log(`Auth URL prepared for ${bankName}:`, redirectUrl);
          setAuthUrl(redirectUrl);
        } else {
          setError('Failed to prepare bank authentication URL');
        }
      } catch (error) {
        if (!isMounted) return;

        console.error('Error preparing auth URL:', error);
        setError('Failed to start bank authentication process');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    prepareAuthUrl();

    return () => {
      isMounted = false;
    };
  }, [bankId, bankName]);

  const handleNavigationStateChange = async (navState: any) => {
    const url = navState.url;
    console.log('WebView navigated to:', url);

    // Only process the redirect once
    if (url.startsWith(TRUELAYER_REDIRECT_URI) && !processingRedirect) {
      setProcessingRedirect(true);
      setLoading(true);
      setShowWebView(false); // Hide WebView to prevent interference
      console.log('WebView hidden');

      try {
        console.log('Redirect URI detected:', url);

        // Extract code from URL
        const code = await trueLayerService.handleRedirectUri(url);
        if (!user) {
          throw new Error('User not authenticated.');
        }

        console.log('Exchanging code for token...');
        await trueLayerService.exchangeCodeForToken(code, user.uid, bankId, bankName);
        console.log('Token exchange successful');

        // Stop the WebView from further loading
        if (webViewRef.current) {
          webViewRef.current.stopLoading();
        }

        // Notify parent of success and return
        setTimeout(() => {
          console.log('Returning to ConnectBankScreen with success');
          navigation.goBack(); // Return to ConnectBankScreen
        }, 2000);
      } catch (error) {
        console.error('Bank auth error:', error);

        // More specific error message
        let errorMessage = 'Failed to connect bank. Please try again.';
        if (error instanceof Error) {
          if (error.message.includes('No authorization code')) {
            errorMessage = 'Authorization code not found in the response. Please try again.';
          } else if (error.message.includes('Token exchange failed')) {
            errorMessage = 'Could not exchange authorization code for token. Please try again.';
          } else {
            errorMessage = `Connection error: ${error.message}`;
          }
        }

        Alert.alert('Connection Failed', errorMessage, [
          {
            text: 'OK',
            onPress: () => {
              try {
                navigation.goBack();
              } catch (navError) {
                console.error('Navigation go back error:', navError);
              }
            },
          },
        ]);
      } finally {
        console.log('Cleanup completed');
        setLoading(false);
        setProcessingRedirect(false);
      }
    }
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>Please go back and try again</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {authUrl && showWebView ? (
        <WebView
          ref={webViewRef}
          source={{ uri: authUrl }}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
          }}
        />
      ) : !authUrl ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={styles.loadingText}>Preparing bank authentication...</Text>
        </View>
      ) : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={styles.loadingText}>Connecting to your bank account...</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={styles.loadingText}>
            {processingRedirect ? 'Connecting to your accounts...' : `Connecting to ${bankName}...`}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  webview: {
    flex: 1,
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ea4335',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 16,
    color: '#5f6368',
    textAlign: 'center',
  },
});

export default BankAuthScreen;