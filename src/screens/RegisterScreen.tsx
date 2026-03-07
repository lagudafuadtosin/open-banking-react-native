import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { AuthContext } from '../context/AuthContext';
import { logError, showErrorAlert } from '../utils/errorHandling';
import COLORS from '../constants/colors';

type RegisterScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Register'>;

interface RegisterScreenProps {
  navigation: RegisterScreenNavigationProp;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { register } = useContext(AuthContext);

  useEffect(() => {
    navigation.setOptions({
      title: 'Register',
    });
  }, [navigation]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.{8,})/;
    return passwordRegex.test(password);
  };

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    
    if (!validatePassword(password)) {
      Alert.alert('Error', 'Password must be at least 8 characters long, contain an uppercase letter, and a special character');
      return;
    }
    
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    
    try {
      setIsLoading(true);
      await register(email, password, name);
    } catch (error: any) {
      logError('RegisterScreen.register', error);
      Alert.alert('Registration Failed', 'Unable to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join the Open Banking revolution</Text>
        
        <View style={styles.formContainer}>
          <TextInput
            style={{
              height: 50,
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 8,
              marginBottom: 15,
              paddingHorizontal: 15,
              backgroundColor: '#FFFFFF',
              color: '#000000',
              fontSize: 16,
            }}
            placeholder="Full Name"
            placeholderTextColor="#999999"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <TextInput
            style={{
              height: 50,
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 8,
              marginBottom: 15,
              paddingHorizontal: 15,
              backgroundColor: '#FFFFFF',
              color: '#000000',
              fontSize: 16,
            }}
            placeholder="Email"
            placeholderTextColor="#999999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={{
              height: 50,
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 8,
              marginBottom: 15,
              paddingHorizontal: 15,
              backgroundColor: '#FFFFFF',
              color: '#000000',
              fontSize: 16,
            }}
            placeholder="Password"
            placeholderTextColor="#999999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TextInput
            style={{
              height: 50,
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 8,
              marginBottom: 15,
              paddingHorizontal: 15,
              backgroundColor: '#FFFFFF',
              color: '#000000',
              fontSize: 16,
            }}
            placeholder="Confirm Password"
            placeholderTextColor="#999999"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
          
          <TouchableOpacity 
            style={styles.registerButton}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.registerButtonText}>Register</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginText}>Already have an account? Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: COLORS.lightGray,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: COLORS.gray,
  },
  formContainer: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 10,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    backgroundColor: COLORS.lightGray,
    color: '#000000',
    placeholderTextColor: '#999999',
    selectionColor: '#000000',
    underlineColorAndroid: 'transparent',
  },
  registerButton: {
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  registerButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginText: {
    color: COLORS.primary,
    textAlign: 'center',
    fontSize: 14,
  },
});

export default RegisterScreen;