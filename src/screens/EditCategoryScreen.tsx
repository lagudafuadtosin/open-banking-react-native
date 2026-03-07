import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { useAuth } from '../context/AuthContext';
import { firebaseService } from '../services/firebaseService';
import { aiService } from '../services/aiService';
import CategoryPicker from '../components/CategoryPicker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import COLORS from '../constants/colors';
import { SessionTimeoutWrapper } from '../hooks/SessionTimeoutWrapper';
import { logError } from '../utils/errorHandling';

type EditCategoryScreenNavigationProp = StackNavigationProp<RootStackParamList, 'EditCategory'>;
type EditCategoryScreenRouteProp = RouteProp<RootStackParamList, 'EditCategory'>;

interface EditCategoryScreenProps {
  navigation: EditCategoryScreenNavigationProp;
  route: EditCategoryScreenRouteProp;
}

const EditCategoryScreen: React.FC<EditCategoryScreenProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const { type, categoryName, pattern, currentCategory, hash } = route.params;
  
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  useEffect(() => {
    // Set header title based on type
    navigation.setOptions({
      title: type === 'rename' ? 'Rename Category' : 'Edit AI Categorization',
      headerLeft: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      ),
    });

    // Set initial selected category
    if (type === 'rename' && categoryName) {
      setSelectedCategory(categoryName);
    } else if (type === 'ai' && currentCategory) {
      setSelectedCategory(currentCategory);
    }

    // Load custom categories
    loadCustomCategories();
  }, [navigation, type, categoryName, currentCategory]);

  const loadCustomCategories = async () => {
    if (!user) return;

    try {
      setLoadingCategories(true);
      const categories = await firebaseService.getCustomCategories(user.uid);
      setCustomCategories(categories);
    } catch (error) {
      logError('EditCategoryScreen.loadCustomCategories', error);
      setCustomCategories([]);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
  };

  const handleCreateCategory = (categoryName: string) => {
    const newCategory = categoryName.trim();
    if (newCategory && !customCategories.includes(newCategory)) {
      setCustomCategories(prev => [...prev, newCategory].sort());
    }
    setSelectedCategory(newCategory);
  };

  const handleSave = async () => {
    if (!user || !selectedCategory.trim()) {
      Alert.alert('Error', 'Please select a category name');
      return;
    }

    try {
      setLoading(true);

      if (type === 'rename') {
        // Rename existing user-defined category
        if (!categoryName) {
          throw new Error('Original category name not provided');
        }

        await firebaseService.renameCustomCategory(user.uid, categoryName, selectedCategory.trim());
        await aiService.clearUserRulesCache(user.uid);
        
        Alert.alert(
          'Success', 
          `Category renamed from "${categoryName}" to "${selectedCategory.trim()}"`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );

      } else if (type === 'ai') {
        // Move AI memory to user rules
        if (!pattern || !hash) {
          throw new Error('AI memory details not provided');
        }

        await firebaseService.moveAIMemoryToUserRule(
          user.uid, 
          hash, 
          pattern, 
          selectedCategory.trim()
        );
        
        // Clear both caches
        await aiService.clearUserRulesCache(user.uid);
        await aiService.clearAIMemoryCache(user.uid);
        
        Alert.alert(
          'Success', 
          `"${pattern}" moved to user-defined category "${selectedCategory.trim()}"`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }

    } catch (error) {
      logError('EditCategoryScreen.handleSave', error);
      Alert.alert(
        'Error', 
        `Failed to ${type === 'rename' ? 'rename category' : 'edit categorization'}. Please try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  if (loadingCategories) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  return (
    <SessionTimeoutWrapper>
      <View style={styles.container}>
        {/* Header Info */}
        <View style={styles.headerInfo}>
          {type === 'rename' ? (
            <Text style={styles.infoText}>
              Rename category: <Text style={styles.highlightText}>"{categoryName}"</Text>
            </Text>
          ) : (
            <>
              <Text style={styles.infoText}>Edit categorization for:</Text>
              <Text style={styles.patternText}>"{pattern}"</Text>
              <Text style={styles.currentCategoryText}>
                Currently: <Text style={styles.highlightText}>{currentCategory}</Text>
              </Text>
            </>
          )}
        </View>

        {/* Category Picker */}
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>
            {type === 'rename' ? 'Choose new name:' : 'Choose new category:'}
          </Text>
          
          <CategoryPicker
            customCategories={customCategories}
            onSelectCategory={handleSelectCategory}
            onCreateCategory={handleCreateCategory}
            selectedCategory={selectedCategory}
          />
        </View>

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!selectedCategory.trim() || loading) && styles.disabledButton
            ]}
            onPress={handleSave}
            disabled={!selectedCategory.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.saveButtonText}>
                {type === 'rename' ? 'Rename Category' : 'Save & Move to User Rules'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
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
    marginLeft: 15,
    padding: 5,
  },
  headerInfo: {
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
  infoText: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
  },
  patternText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    backgroundColor: COLORS.lightGray,
    padding: 10,
    borderRadius: 8,
    textAlign: 'center',
  },
  currentCategoryText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  highlightText: {
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
    marginHorizontal: 15,
    marginTop: 15,
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
  buttonContainer: {
    padding: 20,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  disabledButton: {
    backgroundColor: COLORS.secondary,
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EditCategoryScreen;