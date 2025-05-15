// src/types/index.ts
// Updated with Debug screen and other improvements

import { ParamListBase } from '@react-navigation/native';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber: string | null;
}

export interface AuthContextProps {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (email: string, password: string, name: string) => Promise<any>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  authenticateWithBiometrics: () => Promise<boolean>;
  toggleBiometrics: () => Promise<void>;
}

// Define the Account type (adjust this based on your actual data structure)
export interface Account {
  id: string;
  name: string;
  balance: number;
  currency: string;
  // Add other properties as needed
}

export interface RootStackParamList extends ParamListBase {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  ConnectBank: undefined;
  Accounts: undefined;
  TransactionList: { accountId: string };
  Payment: undefined;
  PaymentConfirmation: { 
    paymentId: string; 
    resourceToken: string; 
    amount: number;
    recipient: { name: string };
  };
  Profile: undefined;
  ChangePassword: undefined;
  LinkedBanks: undefined;
  Analytics: undefined;
  Debug: undefined; // Added Debug screen
  
  // Fix these routes with their proper parameters
  BankAuth: { 
    bankId: string; 
    bankName: string;
  };
  AccountDetails: { 
    accounts: Account[];
  };
}