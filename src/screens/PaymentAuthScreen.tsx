import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Alert,
  SafeAreaView,
  Text,
  AppState,
  AppStateStatus,
} from 'react-native';
import WebView, { WebViewNavigation } from 'react-native-webview';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { trueLayerService } from '../services/trueLayerService';
import { logError } from '../utils/errorHandling';
import COLORS from '../constants/colors';
import { TRUELAYER_REDIRECT_URI } from '@env';
import { SessionTimeoutWrapper } from '../hooks/SessionTimeoutWrapper';

type PaymentAuthScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PaymentAuth'>;
type PaymentAuthScreenRouteProp = RouteProp<RootStackParamList, 'PaymentAuth'>;

interface PaymentAuthScreenProps {
  navigation: PaymentAuthScreenNavigationProp;
  route: PaymentAuthScreenRouteProp;
}

const PaymentAuthScreen: React.FC<PaymentAuthScreenProps> = ({
  navigation,
  route,
}) => {
  const { paymentId, authUrl, amount, recipient } = route.params;
  const [loading, setLoading] = useState(true);
  const [processingRedirect, setProcessingRedirect] = useState(false);
  const webViewRef = useRef<WebView>(null);

      useEffect(() => {
      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        console.log('App state changed to:', nextAppState); // To check redirection
        if (nextAppState === 'active' && !processingRedirect) {
          console.log('Checking payment status in 1 second...');
          // User returned to app, check payment status
          setTimeout(() => {
            checkPaymentAndNavigate();
          }, 1000);
        }
      };

      const subscription = AppState.addEventListener('change', handleAppStateChange);
      return () => subscription?.remove();
    }, [processingRedirect]);

    const checkPaymentAndNavigate = async () => {
      try {
        console.log('checkPaymentAndNavigate called');
        setProcessingRedirect(true);
        const status = await trueLayerService.getPaymentStatus(paymentId);
        console.log('Payment status:', status);
        
        if (status.status === 'executed' || status.status === 'settled' || status.status === 'failed') {
          navigation.navigate('PaymentConfirmation', {
            paymentId,
            amount,
            recipient,
          });
        }
      } catch (error) {
        console.log('Error checking payment status:', error);
      } finally {
        setProcessingRedirect(false);
      }
    };

  // JavaScript to ensure buttons are tappable in WebView
  const injectedJavaScript = `
    (function() {
      document.addEventListener('DOMContentLoaded', function() {
        const buttons = document.querySelectorAll('button, input[type="submit"], [role="button"]');
        buttons.forEach(button => {
          button.style.pointerEvents = 'auto';
          button.style.touchAction = 'manipulation';
          let isProcessing = false;
          button.addEventListener('touchstart', function(e) {
            if (isProcessing) return;
            isProcessing = true;
            e.preventDefault();
            this.click();
            setTimeout(() => {
              isProcessing = false;
            }, 1000);
          });
        });
      });
    })();
    true;
  `;

  const handleNavigationStateChange = async (navState: WebViewNavigation) => {
    const { url } = navState;
    console.log('Payment WebView navigated to:', url);

    if (url.startsWith(TRUELAYER_REDIRECT_URI) && !processingRedirect) {
      setProcessingRedirect(true);
      setLoading(true);
      
      try {
        console.log('Payment redirect URI detected:', url);
        
        const queryString = url.split('?')[1];
        const params = queryString
          ? queryString.split('&').reduce((result: Record<string, string>, param) => {
              const [key, value] = param.split('=');
              if (key && value) {
                result[key] = decodeURIComponent(value);
              }
              return result;
            }, {})
          : {};

        console.log('Payment redirect params:', params);

        // Check for payment_id or use the original paymentId
        const finalPaymentId = params.payment_id || paymentId;

        if (finalPaymentId) {
          console.log('Getting payment status for:', finalPaymentId);
          
          // Get the latest payment status
          const status = await trueLayerService.getPaymentStatus(finalPaymentId);
          console.log('Payment status:', status);

          // Navigate to confirmation with all required data
          navigation.navigate('PaymentConfirmation', {
            paymentId: finalPaymentId,
            amount: amount,
            recipient: recipient,
          });
        } else {
          throw new Error('No payment ID found in redirect');
        }
      } catch (error) {
        logError('PaymentAuthScreen.handleNavigationStateChange', error);
        Alert.alert(
          'Payment Error', 
          'Failed to process payment authorization. Please try again.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Payment')
            }
          ]
        );
      } finally {
        setLoading(false);
        setProcessingRedirect(false);
      }
    }
  };

  const handleWebViewError = (syntheticEvent: any) => {
    console.error('Payment WebView error:', syntheticEvent.nativeEvent);
    Alert.alert(
      'Authorization Error',
      'Failed to load authorization page. This may be a sandbox issue. Please authorize the payment manually in the TrueLayer Console (Payment ID: ' + paymentId + ').',
      [
        { text: 'OK', onPress: () => navigation.navigate('Payment') }
      ]
    );
    setLoading(false);
  };

  const handleHttpError = (syntheticEvent: any) => {
    console.error('Payment WebView HTTP error:', syntheticEvent.nativeEvent);
    if (syntheticEvent.nativeEvent.statusCode === 404) {
      Alert.alert(
        'Authorization Error',
        'HPP URL not found (404). Please authorize the payment manually in the TrueLayer Console (Payment ID: ' + paymentId + ').',
        [
          { text: 'OK', onPress: () => navigation.navigate('Payment') }
        ]
      );
    } else {
      Alert.alert('Error', `HTTP error ${syntheticEvent.nativeEvent.statusCode}. Please try again.`);
    }
    setLoading(false);
  };

  return (
    <SessionTimeoutWrapper>
      <SafeAreaView style={styles.container}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>
              {processingRedirect ? 'Processing payment authorization...' : 'Loading payment authorization...'}
            </Text>
          </View>
        )}
        
        <WebView
          ref={webViewRef}
          source={{ uri: authUrl }}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          // injectedJavaScript={injectedJavaScript}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          thirdPartyCookiesEnabled={true}
          startInLoadingState={false} // Changed from true to test payment auth
          allowsBackForwardNavigationGestures={true}
           mixedContentMode="compatibility"  // Added to test payment auth (if it fails remove)
  allowsInlineMediaPlayback={true}  // Added to test payment auth (if it fails remove)
  mediaPlaybackRequiresUserAction={false}  // Added to test payment auth (if it fails remove)
  userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"  // Iphone behaviour
          onError={handleWebViewError}
          onHttpError={handleHttpError}
        />
      </SafeAreaView>
    </SessionTimeoutWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.gray,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default PaymentAuthScreen;