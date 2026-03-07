import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import COLORS from '../constants/colors';

// Categories
const SPENDING_CATEGORIES = [
  'Shopping & Groceries',
  'Dining & Food', 
  'Transport & Fuel',
  'Entertainment',
  'Utilities & Telecom',
  'Healthcare',
  'ATM Withdrawals',
  'Subscriptions',
  'Bank Fees',
  'Savings & Investments',
  'Personal Transfers',
  'Insurance & Finance',
  'Retail & Electronics',
  'Digital Services',
  'Miscellaneous'
];

// Data structure
interface CategoryItem {
  id: string;
  name: string;
  type: 'ai' | 'custom' | 'create';
  icon: string;
}

interface CategoryPickerProps {
  customCategories: string[]; // User's custom categories
  onSelectCategory: (category: string) => void;
  onCreateCategory: (categoryName: string) => void;
  selectedCategory?: string;
}

const CategoryPicker: React.FC<CategoryPickerProps> = ({
  customCategories,
  onSelectCategory,
  onCreateCategory,
  selectedCategory,
}) => {
  const [searchText, setSearchText] = useState('');
  const [filteredCategories, setFilteredCategories] = useState<CategoryItem[]>([]);

  // Filtering
  useEffect(() => {
    const search = searchText.toLowerCase().trim();
    let categories: CategoryItem[] = [];

    if (search) {
      // Step 1: Filter custom categories first
      const matchingCustom = customCategories
        .filter(cat => cat.toLowerCase().includes(search))
        .map(cat => ({
          id: `custom_${cat}`,
          name: cat,
          type: 'custom' as const,
          icon: '📝',
        }));

      // Step 2: Filter AI categories
      const matchingAI = SPENDING_CATEGORIES
        .filter(cat => cat.toLowerCase().includes(search))
        .map(cat => ({
          id: `ai_${cat}`,
          name: cat,
          type: 'ai' as const,
          icon: '🤖',
        }));

      // Step 3: Add "Create new category" option 
      const exactMatch = [...customCategories, ...SPENDING_CATEGORIES]
        .some(cat => cat.toLowerCase() === search);

      if (!exactMatch && search.length > 0) {
        categories.push({
          id: 'create_new',
          name: searchText.trim(),
          type: 'create',
          icon: '✨',
        });
      }

      // Combine all the three
      categories = [
        ...categories.filter(c => c.type === 'create'),
        ...matchingCustom,
        ...matchingAI,
      ];
    } else {
      // No search - show all categories, custom first
      const customItems = customCategories.map(cat => ({
        id: `custom_${cat}`,
        name: cat,
        type: 'custom' as const,
        icon: '📝',
      }));

      const aiItems = SPENDING_CATEGORIES.map(cat => ({
        id: `ai_${cat}`,
        name: cat,
        type: 'ai' as const,
        icon: '🤖',
      }));

      categories = [...customItems, ...aiItems];
    }

    setFilteredCategories(categories);
  }, [searchText, customCategories]);

  const handleCategoryPress = (item: CategoryItem) => {
    if (item.type === 'create') {
      onCreateCategory(item.name);
    } else {
      onSelectCategory(item.name);
    }
  };

  const renderCategoryItem = ({ item }: { item: CategoryItem }) => {
    const isSelected = selectedCategory === item.name;
    
    return (
      <TouchableOpacity
        style={[
          styles.categoryItem,
          isSelected && styles.selectedCategoryItem,
          item.type === 'create' && styles.createCategoryItem,
        ]}
        onPress={() => handleCategoryPress(item)}
      >
        <Text style={styles.categoryIcon}>{item.icon}</Text>
        <Text style={[
          styles.categoryText,
          isSelected && styles.selectedCategoryText,
          item.type === 'create' && styles.createCategoryText,
        ]}>
          {item.type === 'create' ? `Create "${item.name}"` : item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search or create category..."
        value={searchText}
        onChangeText={setSearchText}
        autoCapitalize="words"
      />
      
      {filteredCategories.length > 0 ? (
        <FlatList
          data={filteredCategories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          style={styles.categoryList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {searchText ? 'No matching categories found' : 'No categories available'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxHeight: 300, // Limit height for modal 
  },
  searchInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: COLORS.white,
  },
  categoryList: {
    flex: 1,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: COLORS.lightGray,
  },
  selectedCategoryItem: {
    backgroundColor: COLORS.primary,
  },
  createCategoryItem: {
    backgroundColor: '#E8F5E8',
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  categoryText: {
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
  },
  selectedCategoryText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  createCategoryText: {
    color: COLORS.success,
    fontWeight: '600',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    color: COLORS.gray,
    fontSize: 14,
    textAlign: 'center',
  },
});

export default CategoryPicker;