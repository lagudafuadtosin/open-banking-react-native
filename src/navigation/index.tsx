import React from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { CommonActions } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Screen imports
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ConnectBankScreen from '../screens/ConnectBankScreen';
import BankAuthScreen from '../screens/BankAuthScreen';
import TransactionListScreen from '../screens/TransactionListScreen';
import PaymentScreen from '../screens/PaymentScreen';
import PaymentConfirmationScreen from '../screens/PaymentConfirmationScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import SplashScreen from '../screens/SplashScreen';
import PaymentAuthScreen from '../screens/PaymentAuthScreen';
import CategoryManagementScreen from '../screens/CategoryManagementScreen';
import EditCategoryScreen from '../screens/EditCategoryScreen';
import CategoryTransactionsScreen from '../screens/CategoryTransactionsScreen';

import { createRef } from 'react';
export const navigationRef = createRef<NavigationContainerRef<RootStackParamList>>();

// Navigation helpers – safe fallback if ref not ready yet
export function navigate(name: string & keyof RootStackParamList, params?: object) {
  if (navigationRef.current) {
    navigationRef.current.dispatch(
      CommonActions.navigate({
        name,
        params,
      })
    );
  } else {
    console.log('Navigation not ready, queueing navigation to:', name);
    setTimeout(() => navigate(name, params), 500);
  }
}

export function reset(index: number = 0, routes: { name: string & keyof RootStackParamList; params?: object }[]) {
  if (navigationRef.current) {
    navigationRef.current.dispatch(
      CommonActions.reset({
        index,
        routes,
      })
    );
  } else {
    console.log('Navigation not ready, queueing reset to:', routes[0]?.name);
    setTimeout(() => reset(index, routes), 500);
  }
}

const Stack = createStackNavigator<RootStackParamList>();

// Shown while auth state is being determined
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#0000ff" />
  </View>
);

// Main navigation config
export const Navigation = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="Splash">
        <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ConnectBank" component={ConnectBankScreen} />
            <Stack.Screen name="BankAuth" component={BankAuthScreen} />
            <Stack.Screen name="TransactionList" component={TransactionListScreen} />
            <Stack.Screen name="Payment" component={PaymentScreen} />
            <Stack.Screen name="PaymentConfirmation" component={PaymentConfirmationScreen} />
            <Stack.Screen name="PaymentAuth" component={PaymentAuthScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Analytics" component={AnalyticsScreen} />
            <Stack.Screen name="CategoryManagement" component={CategoryManagementScreen} />
            <Stack.Screen name="EditCategory" component={EditCategoryScreen} />
            <Stack.Screen name="CategoryTransactions" component={CategoryTransactionsScreen} />
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
