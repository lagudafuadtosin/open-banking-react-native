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
  
  export interface RootStackParamList extends ParamListBase {
    Login: undefined;
    Register: undefined;
    Dashboard: undefined;
    ConnectBank: undefined;
    Accounts: undefined;
    TransactionList: { accountId: string };
    Payment: undefined;
    PaymentConfirmation: { paymentId: string; resourceToken: string; amount: number;
      recipient: { name: string };};
    Profile: undefined;
    ChangePassword: undefined;
    LinkedBanks: undefined;
    Analytics: undefined;
  }