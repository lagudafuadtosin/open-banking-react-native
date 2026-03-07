import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Navigation } from './src/navigation';
import { AuthProvider } from './src/context/AuthContext';
import { trueLayerService } from './src/services/trueLayerService';
// import { setupDeepLinking } from './src/services/deepLinking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Ignore specific warnings related to TrueLayer errors
LogBox.ignoreLogs([
  '[TrueLayerService',  // Ignore any logs starting with this
]);

// Optional: Create a more selective console.error override
const originalConsoleError = console.error;
console.error = (...args) => {
  // If the error is from TrueLayerService, don't show it in the UI
  if (
    args[0] && 
    typeof args[0] === 'string' && 
    args[0].includes('TrueLayerService')
  ) {
      // Use console.debug instead of error to avoid triggering UI error displays
      console.debug('[Suppressed TrueLayer Error]', ...args);
  
    return;
  }
  
  // For all other errors, use the original console.error
  originalConsoleError(...args);
};

const App = () => {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await trueLayerService.initSDK();
        // setupDeepLinking();
      } catch (error) {
        // Use console.debug instead of console.error to avoid UI error displays
        console.debug('App initialization error (suppressed):', error);
      }
    };
    initializeApp();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <AuthProvider>
            <Navigation />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;