import React, { useEffect } from 'react';
import { StatusBar, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Navigation } from './src/navigation';
import { AuthProvider } from './src/context/AuthContext';
import { OfflineProvider } from './src/context/OfflineContext';
import { trueLayerService } from './src/services/trueLayerService';

const App = () => {

  useEffect(() => {
    const handleDeepLink = async ({ url }: { url: string }) => {
      if (url.startsWith('truelayerbankingapp://callback')) {
        try {
          console.log('Handling deep link:', url);
          const code = await trueLayerService.handleRedirectUri(url);
          await trueLayerService.exchangeCodeForToken(code);
          console.log('Successfully exchanged code for token');
        } catch (error) {
          console.error('Failed to handle deep link:', error);
        }
      }
    };

    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });

    const subscription = Linking.addListener('url', handleDeepLink);

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const initializeTrueLayer = async () => {
      try {
        await trueLayerService.initSDK();
        console.log('TrueLayer service initialized');
      } catch (error) {
        console.error('Failed to initialize TrueLayer service:', error);
      }
    };
    initializeTrueLayer();
  }, []);


  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <AuthProvider>
        <OfflineProvider>
          <Navigation />
        </OfflineProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );

};

export default App;