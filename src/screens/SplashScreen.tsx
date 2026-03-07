import React, { useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Text,
  StatusBar,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import COLORS from '../constants/colors';
import { logError } from '../utils/errorHandling';
import { useAuth } from '../context/AuthContext';

type SplashScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Splash'>;

interface SplashScreenProps {
  navigation: SplashScreenNavigationProp;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  const { user } = useAuth();

  useEffect(() => {
    // Navigate to Login or Dashboard after 2.5 seconds based on authentication status
    const timer = setTimeout(() => {
      try {
        navigation.replace(user ? 'Dashboard' : 'Login');
      } catch (error) {
        logError('SplashScreen.navigation', error);
      }
    }, 2500);

    // Clean up timer on unmount
    return () => clearTimeout(timer);
  }, [navigation, user]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      <Image
        source={require('../../assets/banks/blogo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      
      <Text style={styles.title}>FUADBANK335</Text>
      <Text style={styles.subtitle}>Digital Banking</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.gray,
  },
});

export default SplashScreen;