import { ParamListBase } from '@react-navigation/native';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { Transaction } from 'services/trueLayerService';

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
  resetSessionTimeout: () => void;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  currency: string;
}

export interface UserCategoryRule {
  pattern: string;                
  customCategory: string;         
  createdAt: FirebaseFirestoreTypes.Timestamp;
}

export interface RootStackParamList extends ParamListBase {
  Login: undefined;
  Register: undefined;
  Dashboard: undefined;
  ConnectBank: { fromAuth?: boolean } | undefined;
  Accounts: undefined;
  TransactionList: { accountId: string };
  Payment: undefined;
  PaymentConfirmation: {
    paymentId: string;
    amount: number;
    recipient: { name: string };
  };
  PaymentAuth: {
    paymentId: string;
    authUrl: string;
    amount: number;
    recipient: { name: string };
  };
  Profile: undefined;
  Analytics: undefined;
  BankAuth: {
    bankId: string;
    bankName: string;
  };
  CategoryManagement: undefined;
  
  EditCategory: {
  type: 'rename' | 'ai';
  categoryName?: string;
  pattern?: string;
  currentCategory?: string;
  hash?: string;
};

CategoryTransactions: {
  categoryName: string;
  transactions: Transaction[];
  currency: string;
};
}