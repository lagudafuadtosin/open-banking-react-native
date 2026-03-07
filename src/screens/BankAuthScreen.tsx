import React, { useState, useContext, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert, BackHandler, Text, KeyboardAvoidingView, Platform, ScrollView, Keyboard } from 'react-native';
import WebView from 'react-native-webview';
import { trueLayerService } from '../services/trueLayerService';
import { AuthContext } from '../context/AuthContext';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { TRUELAYER_REDIRECT_URI } from '@env';
import COLORS from '../constants/colors';
import { SessionTimeoutWrapper } from '../hooks/SessionTimeoutWrapper';
import { cacheService } from '../services/cacheService';

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

  const injectedJavaScript = `
    (function() {
      // Ensure input fields focus on first tap
      function setupInputFocus() {
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach(input => {
          input.addEventListener('touchstart', function(e) {
            e.stopPropagation();
            this.focus();
            window.ReactNativeWebView.postMessage('Input focused: ' + this.name);
          }, { passive: false });
        });
      }

      // Ensure buttons respond to single tap and prevent keyboard dismissal
      function setupButtonClicks() {
        const buttons = document.querySelectorAll('button, [role="button"], [type="submit"], a');
        let isProcessing = false;
        buttons.forEach(button => {
          button.addEventListener('touchstart', function(e) {
            if (isProcessing) return;
            isProcessing = true;
            e.preventDefault();
            e.stopPropagation();
            this.click();
            window.ReactNativeWebView.postMessage('Button clicked: ' + this.textContent);
            setTimeout(() => { isProcessing = false; }, 1000);
          }, { passive: false });
        });
      }

      // Run on page load and observe DOM changes for dynamic content
      document.addEventListener('DOMContentLoaded', function() {
        setupInputFocus();
        setupButtonClicks();
      });

      // Handle dynamic content (TrueLayer may load elements asynchronously)
      const observer = new MutationObserver(function() {
        setupInputFocus();
        setupButtonClicks();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    })();
    true;
  `;

  // Handle Android hardware back button to prevent back during redirect processing
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!processingRedirect) {
        navigation.goBack();
        return true;
      }
      return true; // Block back navigation during auth redirect
    });

    return () => backHandler.remove();
  }, [navigation, processingRedirect]);

  // Fetch and prepare the bank authentication URL when component mounts
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

  // Handle navigation changes in the WebView, mainly to detect the redirect URI
  const handleNavigationStateChange = async (navState: any) => {
    const url = navState.url;
    console.log('WebView navigated to:', url);

    // Process redirect URI only once
    if (url.startsWith(TRUELAYER_REDIRECT_URI) && !processingRedirect) {
      setProcessingRedirect(true);
      setLoading(true);
      setShowWebView(false); // Hide WebView to avoid UI interference
      console.log('WebView hidden');

      try {
        console.log('Redirect URI detected:', url);

        // Extract authorization code from redirect URL
        const code = await trueLayerService.handleRedirectUri(url);
        if (!user) {
          throw new Error('User not authenticated.');
        }

        console.log('Exchanging code for token...');
        await trueLayerService.exchangeCodeForToken(code, user.uid, bankId, bankName);
        console.log('Token exchange successful');

        // Clear old cache so new bank data loads fresh
        await cacheService.clearAllCache();

        // Stop WebView loading after successful token exchange
        if (webViewRef.current) {
          webViewRef.current.stopLoading();
        }

        // Navigate back after short delay to show success state
        setTimeout(() => {
          console.log('Returning to ConnectBankScreen with success');
          navigation.navigate('ConnectBank', { fromAuth: true });
        }, 2000);
      } catch (error) {
        console.error('Bank auth error:', error);

        // Set user-friendly error messages based on error type
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

  // Add keyboard event listener to scroll input into view
  useEffect(() => {
    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', () => {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          const activeElement = document.activeElement;
          if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        `);
      }
    });

    return () => {
      keyboardDidShow.remove();
    };
  }, []);

  // Show error message screen if error occurs
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>Please go back and try again</Text>
      </View>
    );
  }

  return (
    <SessionTimeoutWrapper>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
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
                thirdPartyCookiesEnabled={true}
                allowsBackForwardNavigationGestures={true}
                allowFileAccess={true}
                cacheEnabled={true}
                cacheMode="LOAD_DEFAULT"
                userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36"
                scalesPageToFit={true}
                bounces={false}
                scrollEnabled={true}
                automaticallyAdjustContentInsets={true}
                keyboardDisplayRequiresUserAction={false}
                injectedJavaScript={injectedJavaScript}
                onError={(syntheticEvent) => {
                  console.error('WebView error:', syntheticEvent.nativeEvent);
                  setError('WebView failed to load. Please try again.');
                }}
                onHttpError={(syntheticEvent) => {
                  console.error('WebView HTTP error:', syntheticEvent.nativeEvent);
                  setError(`HTTP error ${syntheticEvent.nativeEvent.statusCode}. Please try again.`);
                }}
                onMessage={(event) => {
                  console.log('WebView message:', event.nativeEvent.data);
                }}
              />
            ) : !authUrl ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Preparing bank authentication...</Text>
              </View>
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Connecting to your bank account...</Text>
              </View>
            )}

            {loading && (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>
                  {processingRedirect ? 'Connecting to your accounts...' : `Connecting to ${bankName}...`}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SessionTimeoutWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
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
    color: COLORS.gray,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.lightGray,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: 10,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
  },
});

export default BankAuthScreen;