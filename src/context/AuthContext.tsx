import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import { Alert } from 'react-native';
import { firebase, auth } from '../config/firebase';
import { User, AuthContextProps } from '../types/index';
import { secureStorage } from '../services/secureStorage';
import { biometricService } from '../services/biometricService';
import { logError } from '../utils/errorHandling';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSessionTimeout } from '../hooks/useSessionTimeout';

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
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Session timeout handling
  const handleTimeout = async () => {
    if (user) {
      await logout();
    }
  };

  useSessionTimeout(handleTimeout);

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
                // Enable biometric setting in AsyncStorage
                await AsyncStorage.setItem('biometricsEnabled', 'true');
              },
            },
          ]
        );
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
      return userCredential;
    } catch (error) {
      logError('AuthContext.register', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await auth().signOut();
      // Optionally disable biometrics on logout
      await AsyncStorage.setItem('biometricsEnabled', 'false');
    } catch (error) {
      logError('AuthContext.logout', error);
      throw error;
    }
  };

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