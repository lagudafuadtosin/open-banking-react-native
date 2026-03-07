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
  Switch,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/index';
import { useAuth } from '../context/AuthContext';
import { firebaseService } from '../services/firebaseService';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logError, showErrorAlert } from '../utils/errorHandling';
import auth from '@react-native-firebase/auth';
import COLORS from '../constants/colors';
import { SessionTimeoutWrapper } from '../hooks/SessionTimeoutWrapper';

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
  
  // Change password states
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

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
          <Icon name={isEditing ? "close" : "edit"} size={24} color={COLORS.primary} />
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
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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

  const validatePassword = (password: string): boolean => {
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*])(?=.{8,})/;
    return passwordRegex.test(password);
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
    }
  };

  const handleChangePassword = async () => {
    // Validate inputs
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (!validatePassword(newPassword)) {
      Alert.alert('Error', 'New password must be at least 8 characters long, contain an uppercase letter, and a special character');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'No authenticated user found');
      return;
    }

    try {
      setChangingPassword(true);
      const currentUser = auth().currentUser;

      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      const credential = auth.EmailAuthProvider.credential(user.email!, currentPassword);

      // Reauthenticate the user
      await currentUser.reauthenticateWithCredential(credential);

      // Update the password
      await currentUser.updatePassword(newPassword);

      // Reset form and hide it
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowChangePassword(false);

      Alert.alert('Success', 'Your password has been updated successfully.');
    } catch (error: any) {
      logError('ProfileScreen.handleChangePassword', error);
       if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          Alert.alert('Error', 'Current password is incorrect.');
        } else {
          Alert.alert('Error', 'Failed to change password. Please try again.');
        }
    } finally {
      setChangingPassword(false);
    }
  };


  return (
    <SessionTimeoutWrapper>
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
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.profileDetails}>
              <View style={styles.detailRow}>
                <Icon name="phone" size={20} color={COLORS.gray} style={styles.detailIcon} />
                <Text style={styles.detailText}>{phoneNumber || 'No phone number'}</Text>
              </View>
            </View>
          )}
        </View>
        
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          {/* Password Section */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setShowChangePassword(!showChangePassword)}
          >
            <Icon name="lock" size={20} color={COLORS.gray} style={styles.settingIcon} />
            <Text style={styles.settingText}>Change Password</Text>
            <Icon 
              name={showChangePassword ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
              size={20} 
              color={COLORS.gray} 
            />
          </TouchableOpacity>
          
          {/* Change Password Form */}
          {showChangePassword && (
            <View style={styles.passwordFormContainer}>
              <TextInput
                style={styles.input}
                placeholder="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />
              
              <TextInput
                style={styles.input}
                placeholder="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              
              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                secureTextEntry
              />
              
              <TouchableOpacity
                style={[styles.changePasswordButton, changingPassword && styles.disabledButton]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.changePasswordButtonText}>Update Password</Text>
                )}
              </TouchableOpacity>
              
              <Text style={styles.passwordRequirements}>
                Password must be at least 8 characters long, include an uppercase letter, and a special character.
              </Text>
            </View>
          )}
          
          <View style={styles.settingItem}>
            <Icon name="fingerprint" size={20} color={COLORS.gray} style={styles.settingIcon} />
            <Text style={styles.settingText}>Biometric Authentication</Text>
            <Switch
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor={biometricsEnabled ? COLORS.white : '#f4f3f4'}
              ios_backgroundColor={COLORS.border}
              onValueChange={handleToggleBiometrics}
              value={biometricsEnabled}
            />
          </View>
        </View>
        
        <View style={styles.settingsSection}>
          <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Categories</Text>
          
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('CategoryManagement')}
          >
            <Icon name="category" size={20} color={COLORS.gray} style={styles.settingIcon} />
            <Text style={styles.settingText}>Manage Categories</Text>
            <Icon name="keyboard-arrow-right" size={20} color={COLORS.gray} />
          </TouchableOpacity>
        </View>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <TouchableOpacity
            style={[styles.settingItem, styles.logoutItem]}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            <Icon name="exit-to-app" size={20} color={COLORS.error} style={styles.settingIcon} />
            {isLoggingOut ? (
              <ActivityIndicator color={COLORS.error} style={{ flex: 1 }} />
            ) : (
              <Text style={styles.logoutText}>Logout</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SessionTimeoutWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.gray,
    fontSize: 16,
  },
  headerButton: {
    marginRight: 15,
  },
  profileCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    margin: 15,
    borderRadius: 10,
    shadowColor: COLORS.black,
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
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  profileInfo: {
    flex: 1,
  },
  emailText: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 5,
  },
  nameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  profileDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
    color: COLORS.text,
  },
  editForm: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 15,
  },
  label: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: COLORS.lightGray,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: COLORS.secondary,
    opacity: 0.7,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingsSection: {
    backgroundColor: COLORS.white,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 10,
    shadowColor: COLORS.black,
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
    color: COLORS.text,
    marginBottom: 10,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingIcon: {
    marginRight: 15,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  passwordFormContainer: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  changePasswordButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  changePasswordButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  passwordRequirements: {
    fontSize: 12,
    color: COLORS.gray,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  logoutText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.error,
  },
});

export default ProfileScreen;