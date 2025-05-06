import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Import screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ConnectBankScreen from '../screens/ConnectBankScreen';
import AccountsScreen from '../screens/AccountsScreen';
import TransactionListScreen from '../screens/TransactionListScreen';
import PaymentScreen from '../screens/PaymentScreen';
import PaymentConfirmationScreen from '../screens/PaymentConfirmationScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import LinkedBanksScreen from '../screens/LinkedBanksScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';

const Stack = createStackNavigator<RootStackParamList>();

const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#0000ff" />
  </View>
);

export const Navigation = () => {
  const { user, loading } = useAuth(); // Get user and loading from AuthContext

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={user ? 'Dashboard' : 'Login'}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ConnectBank" component={ConnectBankScreen} />
            <Stack.Screen name="Accounts" component={AccountsScreen} />
            <Stack.Screen name="TransactionList" component={TransactionListScreen} />
            <Stack.Screen name="Payment" component={PaymentScreen} />
            <Stack.Screen name="PaymentConfirmation" component={PaymentConfirmationScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="LinkedBanks" component={LinkedBanksScreen} />
            <Stack.Screen name="Analytics" component={AnalyticsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});