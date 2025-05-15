// src/screens/DebugScreen.tsx
// A screen for developers to diagnose and fix issues

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import * as debugHelper from '../utils/debugHelper';

type DebugScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Debug'>;

interface DebugScreenProps {
  navigation: DebugScreenNavigationProp;
}

const DebugScreen: React.FC<DebugScreenProps> = ({ navigation }) => {
  const [diagReport, setDiagReport] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  useEffect(() => {
    navigation.setOptions({
      title: 'Debug Tools',
    });
    
    loadDiagnosticReport();
    checkOfflineMode();
  }, [navigation]);

  const loadDiagnosticReport = async () => {
    setIsLoading(true);
    try {
      const report = await debugHelper.getDiagnosticReport();
      setDiagReport(report);
    } catch (error) {
      Alert.alert('Error', `Failed to generate diagnostic report: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const checkOfflineMode = async () => {
    const enabled = await debugHelper.isOfflineModeEnabled();
    setIsOfflineMode(enabled);
  };

  const handleResetAuth = async () => {
    Alert.alert(
      'Reset Authentication',
      'This will clear all authentication tokens and caches. You will need to reconnect your bank. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const result = await debugHelper.resetAuth();
              Alert.alert('Success', result);
              await loadDiagnosticReport();
            } catch (error) {
              Alert.alert('Error', `Failed to reset authentication: ${error}`);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSetupMockData = async () => {
    setIsLoading(true);
    try {
      const result = await debugHelper.setupMockData();
      Alert.alert('Success', result);
      await loadDiagnosticReport();
    } catch (error) {
      Alert.alert('Error', `Failed to setup mock data: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOfflineMode = async () => {
    setIsLoading(true);
    try {
      let result: string;
      if (isOfflineMode) {
        result = await debugHelper.disableOfflineMode();
        setIsOfflineMode(false);
      } else {
        result = await debugHelper.enableOfflineMode();
        setIsOfflineMode(true);
      }
      Alert.alert('Success', result);
      await loadDiagnosticReport();
    } catch (error) {
      Alert.alert('Error', `Failed to toggle offline mode: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Debug Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={loadDiagnosticReport}
            disabled={isLoading}
          >
            <Text style={styles.actionButtonText}>Refresh Diagnostic Info</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleResetAuth}
            disabled={isLoading}
          >
            <Text style={styles.actionButtonText}>Reset Authentication</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleSetupMockData}
            disabled={isLoading}
          >
            <Text style={styles.actionButtonText}>Setup Mock Data</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.actionButton,
              isOfflineMode ? styles.actionButtonActive : null
            ]}
            onPress={toggleOfflineMode}
            disabled={isLoading}
          >
            <Text 
              style={[
                styles.actionButtonText,
                isOfflineMode ? styles.actionButtonTextActive : null
              ]}
            >
              {isOfflineMode ? 'Disable Offline Mode' : 'Enable Offline Mode'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.reportContainer}>
          <Text style={styles.sectionTitle}>Diagnostic Report</Text>
          {isLoading ? (
            <ActivityIndicator size="large" color="#1a73e8" style={styles.loader} />
          ) : (
            <Text style={styles.reportText}>{diagReport}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  actionsContainer: {
    padding: 15,
    backgroundColor: '#fff',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#202124',
    marginBottom: 15,
  },
  actionButton: {
    backgroundColor: '#1a73e8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  actionButtonActive: {
    backgroundColor: '#34a853',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  actionButtonTextActive: {
    color: '#fff',
  },
  reportContainer: {
    padding: 15,
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
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
  reportText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#202124',
  },
  loader: {
    marginVertical: 20,
  },
});

export default DebugScreen;