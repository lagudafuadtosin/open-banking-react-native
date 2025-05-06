import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/index';
import { useAuth } from '../context/AuthContext';
import { firebaseService } from '../services/firebaseService';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logError, showErrorAlert } from '../utils/errorHandling';

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Profile'>;

interface ProfileScreenProps {
  navigation: ProfileScreenNavigationProp;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, logout, toggleBiometrics } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState<boolean>(false);

  useEffect(() => {
    // Load initial biometrics setting
    const loadBiometricsSetting = async () => {
      const enabled = await AsyncStorage.getItem('biometricsEnabled');
      setBiometricsEnabled(enabled === 'true');
    };
    loadBiometricsSetting();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      title: 'Your Profile',
      headerRight: () => (
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => setIsEditing(!isEditing)}
        >
          <Icon name={isEditing ? "close" : "edit"} size={24} color="#1a73e8" />
        </TouchableOpacity>
      ),
    });
  }, [isEditing, navigation]);

  useEffect(() => {
    // Fetch user profile to ensure decrypted data is loaded
    const fetchUserProfile = async () => {
      if (user) {
        try {
          const profile = await firebaseService.getUserProfile(user.uid);
          if (profile) {
            setDisplayName(profile.displayName || '');
            setPhoneNumber(profile.phoneNumber || '');
          }
        } catch (error) {
          logError('ProfileScreen.fetchUserProfile', error);
          showErrorAlert('Error', 'Failed to load user profile.');
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phone === '' || phoneRegex.test(phone);
  };

  const validateDisplayName = (name: string): boolean => {
    return name.trim().length > 0;
  };

  const handleSave = async () => {
    if (!validateDisplayName(displayName)) {
      Alert.alert('Error', 'Display name cannot be empty.');
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert('Error', 'Please enter a valid phone number.');
      return;
    }

    try {
      setIsLoading(true);
      await firebaseService.saveUserProfile({
        uid: user.uid,
        email: user.email || '',
        displayName,
        phoneNumber,
      });
      setIsEditing(false);
      Alert.alert('Success', 'Your profile has been updated successfully.');
    } catch (error: any) {
      logError('ProfileScreen.handleSave', error);
      showErrorAlert('Error', 'Failed to update your profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (error: any) {
      logError('ProfileScreen.handleLogout', error);
      showErrorAlert('Error', 'Failed to log out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleToggleBiometrics = async () => {
    try {
      await toggleBiometrics();
      const enabled = await AsyncStorage.getItem('biometricsEnabled');
      setBiometricsEnabled(enabled === 'true');
      Alert.alert('Success', `Biometric authentication ${enabled === 'true' ? 'enabled' : 'disabled'}.`);
    } catch (error: any) {
      logError('ProfileScreen.handleToggleBiometrics', error);
      showErrorAlert('Error', 'Failed to update biometric settings. Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          
          <View style={styles.profileInfo}>
            <Text style={styles.emailText}>{user.email || 'No email'}</Text>
            {!isEditing && (
              <Text style={styles.nameText}>{displayName || 'User'}</Text>
            )}
          </View>
        </View>
        
        {isEditing ? (
          <View style={styles.editForm}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your name"
            />
            
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Enter your phone number (e.g., +1234567890)"
              keyboardType="phone-pad"
            />
            
            <TouchableOpacity
              style={[styles.saveButton, isLoading && styles.disabledButton]}
              onPress={handleSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.profileDetails}>
            <View style={styles.detailRow}>
              <Icon name="phone" size={20} color="#5f6368" style={styles.detailIcon} />
              <Text style={styles.detailText}>{phoneNumber || 'No phone number'}</Text>
            </View>
          </View>
        )}
      </View>
      
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Security</Text>
        
        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => navigation.navigate('ChangePassword')}
        >
          <Icon name="lock" size={20} color="#5f6368" style={styles.settingIcon} />
          <Text style={styles.settingText}>Change Password</Text>
          <Icon name="chevron-right" size={20} color="#5f6368" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.settingItem}
          onPress={handleToggleBiometrics}
        >
          <Icon name="fingerprint" size={20} color="#5f6368" style={styles.settingIcon} />
          <Text style={styles.settingText}>
            Biometric Authentication {biometricsEnabled ? '(Enabled)' : '(Disabled)'}
          </Text>
          <Icon name="chevron-right" size={20} color="#5f6368" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => navigation.navigate('LinkedBanks')}
        >
          <Icon name="account-balance" size={20} color="#5f6368" style={styles.settingIcon} />
          <Text style={styles.settingText}>Linked Banks</Text>
          <Icon name="chevron-right" size={20} color="#5f6368" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.settingItem, styles.logoutItem]}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          <Icon name="exit-to-app" size={20} color="#ea4335" style={styles.settingIcon} />
          {isLoggingOut ? (
            <ActivityIndicator color="#ea4335" style={{ flex: 1 }} />
          ) : (
            <Text style={styles.logoutText}>Logout</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#5f6368',
    fontSize: 16,
  },
  headerButton: {
    marginRight: 15,
  },
  profileCard: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1a73e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  emailText: {
    fontSize: 14,
    color: '#5f6368',
    marginBottom: 5,
  },
  nameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#202124',
  },
  profileDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e1e3e6',
    paddingTop: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailIcon: {
    marginRight: 10,
  },
  detailText: {
    fontSize: 16,
    color: '#202124',
  },
  editForm: {
    borderTopWidth: 1,
    borderTopColor: '#e1e3e6',
    paddingTop: 15,
  },
  label: {
    fontSize: 14,
    color: '#5f6368',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e1e3e6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#a0c1ff',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingsSection: {
    backgroundColor: '#fff',
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#202124',
    marginBottom: 10,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e3e6',
  },
  settingIcon: {
    marginRight: 15,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#202124',
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  logoutText: {
    flex: 1,
    fontSize: 16,
    color: '#ea4335',
  },
});

export default ProfileScreen;