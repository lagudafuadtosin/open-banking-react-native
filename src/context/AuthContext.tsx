import React, { createContext, useState, useEffect, ReactNode, useContext, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { firebase, auth } from '../config/firebase';
import { User, AuthContextProps } from '../types/index';
import { secureStorage } from '../services/secureStorage';
import { biometricService } from '../services/biometricService';
import { logError } from '../utils/errorHandling';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSessionTimeout } from '../hooks/useSessionTimeout';
import { navigate, reset } from '../navigation';
import { trueLayerService } from '../services/trueLayerService';

// Use the imported AuthContextProps type
export const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
  authenticateWithBiometrics: async () => false,
  toggleBiometrics: async () => {},
  resetSessionTimeout: () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Create a ref to hold the resetTimeout function to stop that weird issue with the hook
  const timeoutResetRef = useRef<() => void>(() => {
    console.log('Session timeout not initialized yet');
  });
  
  const resetSessionTimeout = () => {
    console.log('resetSessionTimeout called in AuthContext');
    timeoutResetRef.current();
  };

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const userData: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          phoneNumber: firebaseUser.phoneNumber,
        };
        setUser(userData);
          // Load user rules in background 
          import('../services/aiService').then(({ aiService }) => {
          aiService.initializeUserRules(firebaseUser.uid).catch(error => {
          console.log('Background user rules loading failed:', error);
        });
          aiService.initializeAIMemory(firebaseUser.uid).catch(error => {
          console.log('Background AI memory loading failed:', error);
        });
      });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      
      // Check if biometrics are already enabled
      const biometricsEnabled = await AsyncStorage.getItem('biometricsEnabled');
      
      // Only show prompt if biometrics are not already enabled
      if (biometricsEnabled !== 'true') {
        const biometricAvailable = await biometricService.isBiometricAvailable();
        if (biometricAvailable) {
          Alert.alert(
            'Enable Biometric Login',
            'Would you like to use fingerprint/face recognition to log in next time?',
            [
              { text: 'No Thanks', style: 'cancel' },
              {
                text: 'Enable',
                onPress: async () => {
                  const keysExist = await biometricService.keysExist();
                  if (!keysExist) {
                    await biometricService.createKeys();
                  }
                  await secureStorage.storeUserCredentials(email, password);
                  await AsyncStorage.setItem('biometricsEnabled', 'true');
                },
              },
            ]
          );
        }
      }
      
      return userCredential;
    } catch (error) {
      logError('AuthContext.login', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({ displayName: name });
      
      // Flag this as a new user
      await AsyncStorage.setItem('isNewUser', 'true');
      
      return userCredential;
    } catch (error) {
      logError('AuthContext.register', error);
      throw error;
    }
  };

  const logout = async () => {
  try {
    await auth().signOut();
    
    // Clear auth tokens
   await trueLayerService.clearTokens();
    
      // Clear cache
    const allKeys = await AsyncStorage.getAllKeys();
    const allCacheKeys = allKeys.filter(key => key.startsWith('cache_'));
    for (const key of allCacheKeys) {
      await AsyncStorage.removeItem(key);
    }
    
    console.log('Logout complete - all cache and tokens cleared');
  } catch (error) {
    logError('AuthContext.logout', error);
    throw error;
  }
};

  // Session timeout handling - after logout
  const handleTimeout = useCallback(async () => {
    console.log('Session timeout triggered, checking if user is logged in');
    if (user) {
      console.log('User is logged in, proceeding with logout');
      try {
        await logout();
        // Navigate to login screen after timeout
        reset(0, [{ name: 'Login' }]);
        // Show timeout message
        Alert.alert(
          'Session Expired',
          'You have been logged out due to inactivity.',
          [{ text: 'OK' }]
        );
      } catch (error) {
        console.error('Error during timeout logout:', error);
      }
    } else {
      console.log('No user is logged in, ignoring timeout');
    }
  }, [user]);

  // Call hook at the top level, to fix React's Rules of Hooks (read more)
  const { resetTimeout } = useSessionTimeout(handleTimeout);

  // Update the reset function reference when user changes
  useEffect(() => {
    if (user) {
      console.log('User is logged in, enabling session timeout');
      timeoutResetRef.current = resetTimeout;
      // Reset the timeout immediately when user logs in
      resetTimeout();
    } else {
      console.log('No user logged in, disabling session timeout');
      timeoutResetRef.current = () => {
        console.log('No timeout active - user not logged in');
      };
    }
  }, [user, resetTimeout]);

  const resetPassword = async (email: string) => {
    try {
      await auth().sendPasswordResetEmail(email);
    } catch (error) {
      logError('AuthContext.resetPassword', error);
      throw error;
    }
  };

  const authenticateWithBiometrics = async (): Promise<boolean> => {
    try {
      const biometricAvailable = await biometricService.isBiometricAvailable();
      if (!biometricAvailable) {
        Alert.alert('Error', 'Biometric authentication is not available on this device');
        return false;
      }

      const authenticated = await biometricService.authenticate('Log in to your account');
      if (!authenticated) {
        return false;
      }

      const credentials = await secureStorage.getUserCredentials();
      if (!credentials) {
        Alert.alert('Error', 'No stored credentials found. Please log in with email and password first');
        return false;
      }

      await login(credentials.email, credentials.password);
      return true;
    } catch (error) {
      logError('AuthContext.authenticateWithBiometrics', error);
      return false;
    }
  };

  const toggleBiometrics = async () => {
    try {
      const biometricsEnabled = await AsyncStorage.getItem('biometricsEnabled');
      const newValue = biometricsEnabled === 'true' ? 'false' : 'true';
      await AsyncStorage.setItem('biometricsEnabled', newValue);

      if (newValue === 'false') {
        // If disabling biometrics, clear stored credentials
        await secureStorage.clearUserCredentials();
      } else {
        // If enabling biometrics, ensure biometric keys exist
        const keysExist = await biometricService.keysExist();
        if (!keysExist) {
          await biometricService.createKeys();
        }
      }
    } catch (error) {
      logError('AuthContext.toggleBiometrics', error);
      throw error;
    }
  };

  // Check bank authentication and navigate if token exists
  const checkBankAuth = async () => {
    try {
      if (user) {
        // Reset timeout whenever checking bank auth (user activity)
        console.log('Resetting timeout in checkBankAuth');
        resetSessionTimeout();
        
        // Check if this is a new user
        const isNewUser = await AsyncStorage.getItem('isNewUser');
        
        if (isNewUser === 'true') {
          // If it's a new user, navigate to ConnectBank
          console.log('New user detected, navigating to ConnectBank');
          navigate('ConnectBank');
          
          // Clear the new user flag
          await AsyncStorage.setItem('isNewUser', 'false');
        } else {
          // For existing users, check for bank token
          const token = await trueLayerService.getAccessToken();
          if (token) {
            console.log('Bank token detected, navigating to Dashboard');
            navigate('Dashboard');
          } else {
            console.log('No bank token available');
          }
        }
      }
    } catch (error) {
      console.error('Error checking bank auth:', error);
    }
  };

  // Run checkBankAuth when user state changes
  useEffect(() => {
    checkBankAuth();
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        resetPassword,
        authenticateWithBiometrics,
        toggleBiometrics,
        resetSessionTimeout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Add useAuth hook to access the context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};