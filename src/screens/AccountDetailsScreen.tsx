import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';

type AccountDetailsScreenRouteProp = RouteProp<RootStackParamList, 'AccountDetails'>;

interface AccountDetailsScreenProps {
  route: AccountDetailsScreenRouteProp;
}

const AccountDetailsScreen: React.FC<AccountDetailsScreenProps> = ({ route }) => {
  const { accounts } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account Details</Text>
      {accounts.map((account: any) => (
        <View key={account.account_id} style={styles.account}>
          <Text>Account: {account.display_name}</Text>
          <Text>Institution: {account.institution_name}</Text>
          <Text>Account Number: {account.account_number || 'N/A'}</Text>
          <Text>Sort Code: {account.sort_code || 'N/A'}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8f9fa' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: '#1a73e8' },
  account: { marginBottom: 15, padding: 10, backgroundColor: '#fff', borderRadius: 8 },
});

export default AccountDetailsScreen;