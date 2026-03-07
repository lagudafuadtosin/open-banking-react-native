import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, UserCategoryRule } from '../types';
import { useAuth } from '../context/AuthContext';
import { firebaseService } from '../services/firebaseService';
import Icon from 'react-native-vector-icons/MaterialIcons';
import COLORS from '../constants/colors';
import { SessionTimeoutWrapper } from '../hooks/SessionTimeoutWrapper';
import { logError } from '../utils/errorHandling';
import { aiService } from '../services/aiService';


type CategoryManagementScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CategoryManagement'>;

interface CategoryManagementScreenProps {
  navigation: CategoryManagementScreenNavigationProp;
}

interface CategoryWithRules {
  name: string;
  ruleCount: number;
  rules: UserCategoryRule[];
}

const CategoryManagementScreen: React.FC<CategoryManagementScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategoryWithRules[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithRules | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [aiMemoryEntries, setAIMemoryEntries] = useState<Array<{pattern: string, aiCategory: string, hash: string}>>([]);

  // Track all UI state 
    useEffect(() => {
      navigation.setOptions({
        title: 'Manage Categories',
        headerLeft: () => (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.headerButtonText}>Back</Text>
          </TouchableOpacity>
        ),
      });
      
      loadCategories();
    }, [navigation]);

    // Listen for screen focus to reload data
    useEffect(() => {
      const unsubscribe = navigation.addListener('focus', () => {
        console.log('CategoryManagementScreen focused - reloading data');
        loadCategories();
      });

      return unsubscribe;
    }, [navigation]);

  // Load function, to load category from the firebase
  /**
  const loadCategories = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const customCategories = await firebaseService.getCustomCategories(user.uid);
      
      const categoriesWithRules: CategoryWithRules[] = [];
      
      for (const categoryName of customCategories) {
        const rules = await firebaseService.getUserRulesForCategory(user.uid, categoryName);
        categoriesWithRules.push({
          name: categoryName,
          ruleCount: rules.length,
          rules,
        });
      }
      
      // Sort by rule count (most used first)
      categoriesWithRules.sort((a, b) => b.ruleCount - a.ruleCount);
      setCategories(categoriesWithRules);
    } catch (error) {
      logError('CategoryManagementScreen.loadCategories', error);
      Alert.alert('Error', 'Failed to load categories. Please try again.');
    } finally {
      setLoading(false);
    }
  };  */
    const loadCategories = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load user-defined categories
      const customCategories = await firebaseService.getCustomCategories(user.uid);
      
      const categoriesWithRules: CategoryWithRules[] = [];
      
      for (const categoryName of customCategories) {
        const rules = await firebaseService.getUserRulesForCategory(user.uid, categoryName);
        categoriesWithRules.push({
          name: categoryName,
          ruleCount: rules.length,
          rules,
        });
      }
      
      // Sort by rule count (most used first)
      categoriesWithRules.sort((a, b) => b.ruleCount - a.ruleCount);
      setCategories(categoriesWithRules);
      
      // Load AI memory entries
      const aiMemory = await firebaseService.getAIMemoryForDisplay(user.uid);
      setAIMemoryEntries(aiMemory);
      
    } catch (error) {
      logError('CategoryManagementScreen.loadCategories', error);
      Alert.alert('Error', 'Failed to load categories. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  // Function to rename category
  const handleRenameCategory = async () => {
    if (!user || !selectedCategory || !newCategoryName.trim()) {
      Alert.alert('Error', 'Please enter a valid category name');
      return;
    }

    try {
      setLoading(true);
      await firebaseService.renameCustomCategory(user.uid, selectedCategory.name, newCategoryName.trim());
      await aiService.clearUserRulesCache(user.uid);
      setShowRenameModal(false);
      setNewCategoryName('');
      setSelectedCategory(null);
      await loadCategories();
      Alert.alert('Success', `Category renamed to "${newCategoryName.trim()}"`);
    } catch (error) {
      logError('CategoryManagementScreen.handleRenameCategory', error);
      Alert.alert('Error', 'Failed to rename category. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to delete category
  const handleDeleteCategory = (category: CategoryWithRules) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"? This will remove ${category.ruleCount} rule(s).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              setLoading(true);
              await firebaseService.deleteCustomCategory(user.uid, category.name);
              await aiService.clearUserRulesCache(user.uid);
              await loadCategories();
              Alert.alert('Success', `Category "${category.name}" deleted`);
            } catch (error) {
              logError('CategoryManagementScreen.handleDeleteCategory', error);
              Alert.alert('Error', 'Failed to delete category. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  /**  // Handle editing AI memory entry
  const handleEditAIMemory = async () => {
    if (!user || !selectedAIEntry || !newAICategoryName.trim()) {
      Alert.alert('Error', 'Please enter a valid category name');
      return;
    }

    try {
      setLoading(true);
      await firebaseService.moveAIMemoryToUserRule(
        user.uid, 
        selectedAIEntry.hash, 
        selectedAIEntry.pattern, 
        newAICategoryName.trim()
      );
      
      // Clear both caches
      await aiService.clearUserRulesCache(user.uid);
      await aiService.clearAIMemoryCache(user.uid);
      
      setShowEditAIModal(false);
      setNewAICategoryName('');
      setSelectedAIEntry(null);
      await loadCategories();
      Alert.alert('Success', `"${selectedAIEntry.pattern}" moved to user-defined categories`);
    } catch (error) {
      logError('CategoryManagementScreen.handleEditAIMemory', error);
      Alert.alert('Error', 'Failed to edit AI memory. Please try again.');
    } finally {
      setLoading(false);
    }
  }; */

  const renderCategoryItem = ({ item }: { item: CategoryWithRules }) => (
    <View style={styles.categoryItem}>
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>{item.name}</Text>
        <Text style={styles.categoryDetails}>
          {item.ruleCount} rule{item.ruleCount !== 1 ? 's' : ''}
        </Text>
      </View>
      
      <View style={styles.categoryActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setSelectedCategory(item);
            setShowRulesModal(true);
          }}
        >
          <Icon name="list" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('EditCategory', { 
            type: 'rename', 
            categoryName: item.name 
          })}
        >
          <Icon name="edit" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteCategory(item)}
        >
          <Icon name="delete" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRuleItem = ({ item }: { item: UserCategoryRule }) => (
    <View style={styles.ruleItem}>
      <Text style={styles.rulePattern}>"{item.pattern}"</Text>
      <Text style={styles.ruleCategory}>→ {item.customCategory}</Text>
    </View>
  );

    const renderAIMemoryItem = ({ item }: { item: {pattern: string, aiCategory: string, hash: string} }) => (
    <View style={styles.categoryItem}>
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>"{item.pattern}"</Text>
        <Text style={styles.categoryDetails}>→ {item.aiCategory}</Text>
      </View>
      
      <View style={styles.categoryActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('EditCategory', { 
          type: 'ai', 
          pattern: item.pattern,
          currentCategory: item.aiCategory,
          hash: item.hash
        })}
        >
          <Icon name="edit" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  return (
    <SessionTimeoutWrapper>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={true}>
      {/* User-Defined Categories Section */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>User-Defined Categories</Text>
        {categories.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>
              No custom categories yet. Long-press transactions to create them.
            </Text>
          </View>
        ) : (
          <FlatList
            data={categories}
            renderItem={renderCategoryItem}
            keyExtractor={(item) => item.name}
            scrollEnabled={false}
          />
        )}
      </View>

      {/* AI Memory Section */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Auto Categorized (AI)</Text>
        {aiMemoryEntries.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionText}>
              AI will learn and remember transaction patterns over time.
            </Text>
          </View>
        ) : (
          <FlatList
            data={aiMemoryEntries}
            renderItem={renderAIMemoryItem}
            keyExtractor={(item) => item.hash}
            scrollEnabled={false}
          />
        )}
      </View>
    

        {/* Rename Category Modal */}
        <Modal visible={showRenameModal} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Rename Category</Text>
              
              <TextInput
                style={styles.textInput}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="Enter new category name"
                autoCapitalize="words"
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowRenameModal(false);
                    setNewCategoryName('');
                    setSelectedCategory(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleRenameCategory}
                >
                  <Text style={styles.saveButtonText}>Rename</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* View Rules Modal */}
        <Modal visible={showRulesModal} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Rules for "{selectedCategory?.name}"
              </Text>
              
              {selectedCategory && selectedCategory.rules.length > 0 ? (
                <FlatList
                  data={selectedCategory.rules}
                  renderItem={renderRuleItem}
                  keyExtractor={(item, index) => `${item.pattern}_${index}`}
                  style={styles.rulesList}
                />
              ) : (
                <Text style={styles.noRulesText}>No rules found</Text>
              )}
              
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowRulesModal(false);
                  setSelectedCategory(null);
                }}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        
      </ScrollView>
    </SessionTimeoutWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
  },
  headerButton: {
    marginLeft: 15,
  },
  headerButtonText: {
    color: COLORS.primary,
    fontSize: 16,
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
  listContainer: {
    padding: 15,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  categoryDetails: {
    fontSize: 14,
    color: COLORS.gray,
  },
  categoryActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: COLORS.text,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: COLORS.text,
  },
  saveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  rulesList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  ruleItem: {
    backgroundColor: COLORS.lightGray,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  rulePattern: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  ruleCategory: {
    fontSize: 12,
    color: COLORS.gray,
  },
  noRulesText: {
    textAlign: 'center',
    color: COLORS.gray,
    fontSize: 16,
    marginVertical: 20,
  },
  closeButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: 'bold',
  },

  sectionContainer: {
  marginBottom: 20,
},
sectionTitle: {
  fontSize: 16,
  fontWeight: 'bold',
  color: COLORS.text,
  marginBottom: 10,
  paddingHorizontal: 15,
},
emptySection: {
  backgroundColor: COLORS.white,
  padding: 20,
  borderRadius: 10,
  marginHorizontal: 15,
  alignItems: 'center',
},
emptySectionText: {
  color: COLORS.gray,
  fontSize: 14,
  textAlign: 'center',
  fontStyle: 'italic',
},
aiPatternText: {
  fontSize: 16,
  fontWeight: '500',
  color: COLORS.text,
  textAlign: 'center',
  marginBottom: 15,
  backgroundColor: COLORS.lightGray,
  padding: 10,
  borderRadius: 8,
},



});

export default CategoryManagementScreen;