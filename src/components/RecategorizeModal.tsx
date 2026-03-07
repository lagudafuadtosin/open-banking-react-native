import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { firebaseService } from '../services/firebaseService';
import { useAuth } from '../context/AuthContext';
import { logError } from '../utils/errorHandling';
import CategoryPicker from './CategoryPicker';
import COLORS from '../constants/colors';
import { aiService } from '../services/aiService';

interface RecategorizeModalProps {
  visible: boolean;
  onClose: () => void;
  transaction: {
    description: string;
    currentCategory: string;
  } | null;
  onCategoryChanged?: (newCategory: string) => void;
  // userId?: string;
}

const RecategorizeModal: React.FC<RecategorizeModalProps> = ({
  visible,
  onClose,
  transaction,
  onCategoryChanged,
}) => {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false); // need to check to be sure it saves well
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Get existing custom categories
  useEffect(() => {
    if (visible && user) {
      loadCustomCategories();
      setSelectedCategory(transaction?.currentCategory || '');
    }
  }, [visible, user, transaction]);

const loadCustomCategories = async () => {
  if (!user) return;

  // Step 1: Get all user rules from Firebase
  try {
    setLoadingCategories(true);
    const categories = await firebaseService.getCustomCategories(user.uid);
    setCustomCategories(categories);
  } catch (error) {
    logError('RecategorizeModal.loadCustomCategories', error);
    setCustomCategories([]);
  } finally {
    setLoadingCategories(false);
  }
};

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
  };

  const handleCreateCategory = (categoryName: string) => {
    // Add to custom categories list and select it
    const newCategory = categoryName.trim();
    if (newCategory && !customCategories.includes(newCategory)) {
      setCustomCategories(prev => [...prev, newCategory].sort());
    }
    setSelectedCategory(newCategory);
  };

  
  const handleSave = async () => {
    if (!user || !transaction || !selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    try {
      setLoading(true);
      // Save the user rule to Firebase
      await firebaseService.saveUserCategoryRule(
        user.uid,
        transaction.description,
        selectedCategory
      );
      
      await aiService.clearUserRulesCache(user.uid);
      onCategoryChanged?.(selectedCategory);
      
      // Show success feedback
      Alert.alert(
        'Category Updated',
        `"${transaction.description}" will now be categorized as "${selectedCategory}"`,
        [{ text: 'OK', onPress: onClose }]
      );
      
    } catch (error) {
      logError('RecategorizeModal.handleSave', error);
      Alert.alert(
        'Error',
        'Failed to save category rule. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedCategory('');
    onClose();
  };

  if (!transaction) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Recategorize Transaction</Text>
          <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDescription}>
            {transaction.description}
          </Text>
          <Text style={styles.currentCategory}>
            Currently: {transaction.currentCategory}
          </Text>
        </View>

        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Choose New Category:</Text>
          
          {loadingCategories ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading categories...</Text>
            </View>
          ) : (
            <CategoryPicker
              customCategories={customCategories}
              onSelectCategory={handleSelectCategory}
              onCreateCategory={handleCreateCategory}
              selectedCategory={selectedCategory}
            />
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!selectedCategory || loading) && styles.disabledButton
            ]}
            onPress={handleSave}
            disabled={!selectedCategory || loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save Rule</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 18,
    color: COLORS.gray,
  },
  transactionInfo: {
    backgroundColor: COLORS.white,
    padding: 20,
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 10,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  currentCategory: {
    fontSize: 14,
    color: COLORS.gray,
  },
  pickerContainer: {
    flex: 1,
    marginHorizontal: 15,
    marginTop: 20,
    marginBottom: 15,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.gray,
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingBottom: 30,
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  cancelButtonText: {
    fontSize: 16,
    color: COLORS.text,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  disabledButton: {
    backgroundColor: COLORS.secondary,
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
});

export default RecategorizeModal;