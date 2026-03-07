import { GOOGLE_GEMINI_API_KEY } from '@env';
import { logError } from '../utils/errorHandling';
import { cacheService } from './cacheService';
import CryptoJS from 'react-native-crypto-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { firebaseService } from './firebaseService';

// Initialize gemini
const genAI = new GoogleGenerativeAI(GOOGLE_GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Category mapping confirm if it is too much
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

interface CategorizeOptions {
  useCache?: boolean;
  maxRetries?: number;
}

export class AIService {
  private lastApiCall: number = 0;
  private minDelayBetweenCalls: number = 1000; // 1 second between API calls
  private maxRetries: number = 3;
  
  // Generate consistent cache key for transaction descriptions
  private generateCacheKey(description: string): string {
    const normalized = description.trim().toLowerCase();
    const hash = CryptoJS.MD5(normalized).toString();
    return `ai_category_${hash}`;
  }
  
  // Generate cache key for batch of transactions - this prevents repeat AI calls
  private generateBatchCacheKey(descriptions: string[]): string {
    const sortedDescriptions = [...descriptions].sort(); // Sort to ensure consistent key
    const combined = sortedDescriptions.join('|');
    const hash = CryptoJS.MD5(combined).toString();
    return `ai_batch_${hash}`;
  }
  
  // Add delay for rate limiting
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Main categorization method with caching
  async categorizeTransaction(
    description: string, 
    options: CategorizeOptions = {}
  ): Promise<string> {
    const { useCache = true, maxRetries = this.maxRetries } = options;
    
    try {
      // Clean the description
      const cleanDescription = description.trim();
      if (!cleanDescription) return 'Miscellaneous';
      
      // Check cache first
      if (useCache) {
        const cacheKey = this.generateCacheKey(cleanDescription);
        const cachedResult = await cacheService.getCache<string>(cacheKey, {
          expiryMinutes: 24 * 60 // 24 hours
        });
        
        if (cachedResult) {
          console.log('AI categorization cache hit for:', cleanDescription.substring(0, 20));
          return cachedResult;
        }
      }
      
      // Try AI categorization with rate limiting and retries
      let category: string | null = null;
      
      try {
        category = await this.categorizeWithAI(cleanDescription, maxRetries);
        
        // Cache successful AI result
        if (category && useCache) {
          const cacheKey = this.generateCacheKey(cleanDescription);
          await cacheService.setCache(cacheKey, category, {
            expiryMinutes: 24 * 60 // 24 hours
          });
          console.log('AI categorization cached for:', cleanDescription.substring(0, 20));
        }
      } catch (error) {
        console.log('AI categorization failed, using fallback for:', cleanDescription.substring(0, 20));
        logError('AIService.categorizeTransaction', error);
      }
      
      // Use fallback if AI failed or returned invalid result
      if (!category || !SPENDING_CATEGORIES.includes(category)) {
        category = this.comprehensiveFallbackCategorization(cleanDescription);
      }
      
      return category;
      
    } catch (error) {
      logError('AIService.categorizeTransaction', error);
      return this.comprehensiveFallbackCategorization(description);
    }
  }
  
  // AI categorization with rate limiting and retries - here is where the AI is asked to sort
  private async categorizeWithAI(description: string, maxRetries: number): Promise<string> {
    let attempt = 0;
    let lastError: any;
    
    while (attempt < maxRetries) {
      try {
        // Rate limiting - ensure minimum delay between API calls
        const timeSinceLastCall = Date.now() - this.lastApiCall;
        if (timeSinceLastCall < this.minDelayBetweenCalls) {
          await this.delay(this.minDelayBetweenCalls - timeSinceLastCall);
        }
        
        this.lastApiCall = Date.now();
        
        // Make the AI request - tell Gemini exactly what categories to use
        const result = await geminiModel.generateContent(
          `Categorize this transaction: "${description}"
          Categories: ${SPENDING_CATEGORIES.join(', ')}
          Return only the category name.`
        );
                
        // Validate result - Google Gemini format
        if (result && result.response) {
          const responseText = result.response.text().trim();
          
          // Check if the response is one of our valid categories
          if (SPENDING_CATEGORIES.includes(responseText)) {
            return responseText;
          }
          
          // Sometimes AI returns category with extra text, try to match
          const matchedCategory = SPENDING_CATEGORIES.find(cat => 
            responseText.includes(cat) || cat.includes(responseText)
          );
          
          if (matchedCategory) {
            return matchedCategory;
          }
        }

        throw new Error('Invalid AI response format or category');
        
      } catch (error: any) {
        lastError = error;
        attempt++;
        
        // Check if it's a rate limit error
        if (error.message?.includes('429') || error.message?.includes('rate limit')) {
          console.log(`Rate limit hit, attempt ${attempt}/${maxRetries}`);
          // Exponential backoff for rate limits
          const backoffDelay = Math.min(5000, 1000 * Math.pow(2, attempt));
          await this.delay(backoffDelay);
        } else if (error.message?.includes('500')) {
          console.log(`Server error, attempt ${attempt}/${maxRetries}`);
          // Shorter delay for server errors
          await this.delay(2000);
        } else {
          // For other errors, don't retry
          break;
        }
      }
    }
    
    throw lastError || new Error('AI categorization failed after retries');
  }
  
  // Comprehensive keyword-based fallback categorization
  public comprehensiveFallbackCategorization(description: string): string {
    const desc = description.toUpperCase();
    
    // Shopping & Groceries
    if (desc.includes('TESCO') || desc.includes('STORE') || desc.includes('SHOP') || 
        desc.includes('ASDA') || desc.includes('SAINSBURY') || desc.includes('LIDL') ||
        desc.includes('SPAR') || desc.includes('DUNNES') || desc.includes('SUPERVALUE') ||
        desc.includes('CENTRA') || desc.includes('GROCERY') || desc.includes('SUPERMARKET') ||
        desc.includes('MARKS & SPENCER') || desc.includes('M&S') || desc.includes('WAITROSE') ||
        desc.includes('COOP') || desc.includes('CO-OP') || desc.includes('ICELAND')) {
      return 'Shopping & Groceries';
    }
    
    // ATM Withdrawals
    if (desc.includes('ATM') || desc.includes('CASH WITHDRAWAL') || desc.includes('CASHPOINT')) {
      return 'ATM Withdrawals';
    }
    
    // Entertainment & Gaming
    if (desc.includes('GAMES') || desc.includes('ENTERTAINMENT') || desc.includes('BET365') ||
        desc.includes('VIRGIN GAMES') || desc.includes('CINEMA') || desc.includes('THEATRE') ||
        desc.includes('NETFLIX') || desc.includes('SPOTIFY') || desc.includes('STEAM') ||
        desc.includes('XBOX') || desc.includes('PLAYSTATION') || desc.includes('BETTING') ||
        desc.includes('CASINO') || desc.includes('LOTTERY')) {
      return 'Entertainment';
    }
    
    // Digital Services
    if (desc.includes('GOOGLE PLAY') || desc.includes('APP STORE') || desc.includes('DIGITAL') ||
        desc.includes('APPLE.COM') || desc.includes('MICROSOFT') || desc.includes('AMAZON PRIME') ||
        desc.includes('ICLOUD') || desc.includes('ADOBE') || desc.includes('ZOOM')) {
      return 'Digital Services';
    }
    
    // Utilities & Telecom
    if (desc.includes('TELECOM') || desc.includes('PHONE') || desc.includes('INTERNET') || 
        desc.includes('TALKTALK') || desc.includes('E.ON') || desc.includes('OVO ENERGY') ||
        desc.includes('BRITISH GAS') || desc.includes('EDF') || desc.includes('SCOTTISH POWER') ||
        desc.includes('VODAFONE') || desc.includes('EE') || desc.includes('THREE') ||
        desc.includes('O2') || desc.includes('BT') || desc.includes('SKY') ||
        desc.includes('VIRGIN MEDIA') || desc.includes('UTILITY') || desc.includes('ELECTRIC') ||
        desc.includes('GAS BILL') || desc.includes('WATER') || desc.includes('COUNCIL TAX')) {
      return 'Utilities & Telecom';
    }
    
    // Subscriptions & Memberships
    if (desc.includes('MEMBERSHIP') || desc.includes('SUBSCRIPTION') || desc.includes('AA MEMBERSHIP') ||
        desc.includes('AMAZON PRIME') || desc.includes('GYM') || desc.includes('FITNESS') ||
        desc.includes('MONTHLY') || desc.includes('ANNUAL') || desc.includes('RECURRING')) {
      return 'Subscriptions';
    }
    
    // Bank Fees
    if (desc.includes('OVERDRAFT') || desc.includes('FEE') || desc.includes('CHARGE') ||
        desc.includes('BANK FEE') || desc.includes('SERVICE CHARGE') || desc.includes('INTEREST') ||
        desc.includes('PENALTY') || desc.includes('MAINTENANCE')) {
      return 'Bank Fees';
    }
    
    // Savings & Investments
    if (desc.includes('SAVE THE CHANGE') || desc.includes('SAVINGS') || desc.includes('INVESTMENT') ||
        desc.includes('PENSION') || desc.includes('ISA') || desc.includes('VANGUARD') ||
        desc.includes('FIDELITY') || desc.includes('HARGREAVES')) {
      return 'Savings & Investments';
    }
    
    // Insurance & Finance
    if (desc.includes('INSURANCE') || desc.includes('L&G') || desc.includes('HALIFAX') ||
        desc.includes('AVIVA') || desc.includes('ZURICH') || desc.includes('AXA') ||
        desc.includes('PRUDENTIAL') || desc.includes('LEGAL & GENERAL') || desc.includes('LOAN') ||
        desc.includes('CREDIT') || desc.includes('FINANCE') || desc.includes('POLICY')) {
      return 'Insurance & Finance';
    }
    
    // Dining & Food
    if (desc.includes('MCDONALD') || desc.includes('RESTAURANT') || desc.includes('CAFE') ||
        desc.includes('STARBUCKS') || desc.includes('COSTA') || desc.includes('SUBWAY') ||
        desc.includes('KFC') || desc.includes('BURGER KING') || desc.includes('PIZZA') ||
        desc.includes('TAKEAWAY') || desc.includes('DELIVERY') || desc.includes('UBER EATS') ||
        desc.includes('JUST EAT') || desc.includes('DELIVEROO') || desc.includes('FOOD') ||
        desc.includes('DINING') || desc.includes('PUB') || desc.includes('BAR')) {
      return 'Dining & Food';
    }
    
    // Retail & Electronics
    if (desc.includes('HARVEY NORMAN') || desc.includes('RETAIL') || desc.includes('CURRYS') ||
        desc.includes('ARGOS') || desc.includes('JOHN LEWIS') || desc.includes('NEXT') ||
        desc.includes('ZARA') || desc.includes('H&M') || desc.includes('ELECTRONICS') ||
        desc.includes('COMPUTER') || desc.includes('LAPTOP') || desc.includes('PHONE SHOP')) {
      return 'Retail & Electronics';
    }
    
    // Transport & Fuel
    if (desc.includes('CIRCLE K') || desc.includes('PETROL') || desc.includes('FUEL') ||
        desc.includes('APPLLEGREEN') || desc.includes('BP') || desc.includes('SHELL') ||
        desc.includes('ESSO') || desc.includes('TEXACO') || desc.includes('UBER') ||
        desc.includes('TAXI') || desc.includes('TRANSPORT') || desc.includes('BUS') ||
        desc.includes('TRAIN') || desc.includes('PARKING') || desc.includes('TOLL') ||
        desc.includes('CAR PARK') || desc.includes('TFL') || desc.includes('OYSTER')) {
      return 'Transport & Fuel';
    }
    
    // Healthcare
    if (desc.includes('PHARMACY') || desc.includes('CHEMIST') || desc.includes('MEDICAL') ||
        desc.includes('DOCTOR') || desc.includes('DENTIST') || desc.includes('HOSPITAL') ||
        desc.includes('BOOTS') || desc.includes('SUPERDRUG') || desc.includes('NHS') ||
        desc.includes('PRESCRIPTION') || desc.includes('HEALTH')) {
      return 'Healthcare';
    }
    
    // Personal Transfers - Check if it's a personal name (contains common titles or looks like a name)
    if (desc.match(/^(MR|MS|MRS|DR|MISS)\s/) || desc.match(/^[A-Z]+\s[A-Z]+$/)) {
      return 'Personal Transfers';
    }
    
    return 'Miscellaneous';
  }
  
  // Batch processing for multiple transactions
  async categorizeTransactions(descriptions: string[]): Promise<string[]> {
    const results: string[] = [];
    const batchSize = 5; // Process 5 at a time
    
    for (let i = 0; i < descriptions.length; i += batchSize) {
      const batch = descriptions.slice(i, i + batchSize);
      
      const batchPromises = batch.map(desc => 
        this.categorizeTransaction(desc).catch(error => {
          logError('AIService.categorizeTransactions', error);
          return this.comprehensiveFallbackCategorization(desc);
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < descriptions.length) {
        await this.delay(500);
      }
    }
    
    return results;
  }
  
  /** Before user-defined categpry
  // Main hybrid approach with batch caching - this prevents repeat Analytics visits from hitting AI
  async categorizeTransactionsHybrid(descriptions: string[]): Promise<string[]> {
    console.log(`Starting hybrid categorization for ${descriptions.length} transactions`);
    
    // Check for cached batch results first - saves API costs on repeat visits
    const batchCacheKey = this.generateBatchCacheKey(descriptions);
    const cachedBatchResult = await cacheService.getCache<string[]>(batchCacheKey, {
      expiryMinutes: 2 // Match your existing 2-minute cache strategy
    });
    // you can remove all the console logs if not needed later, for clean up.. leave the descriptive comments for later upgrades
    if (cachedBatchResult) {
      console.log('✅ Found cached batch results - no AI calls needed');
      return cachedBatchResult;
    }
    
    // Step 1: Run keyword matching on ALL transactions (fast)
    const keywordResults = descriptions.map(desc => 
      this.comprehensiveFallbackCategorization(desc)
    );
    
    // Step 2: Find transactions that need AI (returned "Miscellaneous")
    const unclearIndices: number[] = [];
    const unclearDescriptions: string[] = [];
    
    keywordResults.forEach((result, index) => {
      if (result === 'Miscellaneous') {
        unclearIndices.push(index);
        unclearDescriptions.push(descriptions[index]);
      }
    });
    
    console.log(`Keyword matching: ${descriptions.length - unclearDescriptions.length} categorized, ${unclearDescriptions.length} need AI`);
    
    // Step 3: Check if unclear transactions are individually cached (24-hour cache)
    const finalUnclearIndices: number[] = [];
    const finalUnclearDescriptions: string[] = [];
    
    for (let i = 0; i < unclearDescriptions.length; i++) {
      const description = unclearDescriptions[i];
      const cacheKey = this.generateCacheKey(description);
      const cachedResult = await cacheService.getCache<string>(cacheKey, {
        expiryMinutes: 24 * 60 // 24 hours
      });
      
      if (cachedResult) {
        // Use cached individual result
        const originalIndex = unclearIndices[i];
        keywordResults[originalIndex] = cachedResult;
        console.log(`Individual cache hit for: ${description.substring(0, 20)}`);
      } else {
        // Still needs AI processing
        finalUnclearIndices.push(unclearIndices[i]);
        finalUnclearDescriptions.push(description);
      }
    }
    
    // Step 4: Process remaining unclear transactions with AI (if any)
    if (finalUnclearDescriptions.length > 0) {
      try {
        console.log('\n🤖 Sending to AI for categorization:');
        finalUnclearDescriptions.forEach((desc, index) => {
          console.log(`  ${index + 1}. "${desc}"`);
        });
        
        const aiResults = await this.categorizeTransactions(finalUnclearDescriptions);
        
        console.log('\n✅ AI Categorization Results:');
        
        // Merge AI results back into keyword results
        finalUnclearIndices.forEach((originalIndex, aiIndex) => {
          const description = finalUnclearDescriptions[aiIndex];
          const category = aiResults[aiIndex];
          keywordResults[originalIndex] = category;
          
          console.log(`  "${description}" → ${category}`);
        });
        
        console.log(`\n🎯 AI processing completed: ${finalUnclearDescriptions.length} transactions categorized`);
      } catch (error) {
        console.log('AI processing failed, keeping keyword results for unclear transactions');
        logError('AIService.categorizeTransactionsHybrid', error);
        // Keep "Miscellaneous" for failed AI calls
      }
    }
    
    // Cache the final batch results for 2 minutes - prevents repeat Analytics visits from hitting AI
    await cacheService.setCache(batchCacheKey, keywordResults, {
      expiryMinutes: 2
    });
    console.log('💾 Cached batch results for 2 minutes');
    
    console.log('\n📊 Categorization Summary:');
    const categoryCounts = keywordResults.reduce((acc, category) => {
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count} transactions`);
      });
      
    return keywordResults;
  } */

    /**
    // Check if there is a user defined rule in firebase
  private async checkUserRules(description: string, userId: string): Promise<string | null> {
    try {
      const hash = this.generateDescriptionHash(description);
      const userRule = await firebaseService.getUserCategoryRule(userId, hash);
      if (userRule) {
        console.log(`✅ User rule: "${description}" → ${userRule.customCategory}`);
        return userRule.customCategory;
      }
      return null;
    } catch (error) {
      logError('AIService.checkUserRules', error);
      return null;
    }
  } */
    // Initialize user rules cache (called at login)
    async initializeUserRules(userId: string): Promise<void> {
      try {
        console.log('🔄 Loading user rules in background...');
        const allRules = await firebaseService.getAllUserRules(userId);
        
        // Store in cache for 60 minutes
        await cacheService.setCache(`user_rules_${userId}`, allRules, {
          expiryMinutes: 60
        });
        
        console.log(`✅ Cached ${Object.keys(allRules).length} user rules`);
      } catch (error) {
        logError('AIService.initializeUserRules', error);
      }
    }

    // Load all user rules (cache-first)
    private async loadAllUserRules(userId: string): Promise<{ [hash: string]: string }> {
      try {
        // Check cache first
        const cached = await cacheService.getCache<{ [hash: string]: string }>(`user_rules_${userId}`, {
          expiryMinutes: 60
        });
        
        if (cached) {
          console.log(`📋 Using cached user rules (${Object.keys(cached).length} rules)`);
          return cached;
        }
        
        // Cache miss - load from Firebase and cache
        console.log('📋 Cache miss - loading user rules from Firebase...');
        const allRules = await firebaseService.getAllUserRules(userId);
        
        await cacheService.setCache(`user_rules_${userId}`, allRules, {
          expiryMinutes: 60
        });
        
        return allRules;
      } catch (error) {
        logError('AIService.loadAllUserRules', error);
        return {};
      }
    }

    // Initialize AI memory cache
    async initializeAIMemory(userId: string): Promise<void> {
      try {
        console.log('🤖 Loading AI memory in background...');
        const aiMemory = await firebaseService.getAllAIMemory(userId);
        
        // Store in cache for 60 minutes
        await cacheService.setCache(`ai_memory_${userId}`, aiMemory, {
          expiryMinutes: 60
        });
        
        console.log(`✅ Cached ${Object.keys(aiMemory).length} AI memory entries`);
      } catch (error) {
        logError('AIService.initializeAIMemory', error);
      }
    }

    // Load all AI memory go cache
    private async loadAllAIMemory(userId: string): Promise<{ [hash: string]: string }> {
      try {
        // Check cache first
        const cached = await cacheService.getCache<{ [hash: string]: string }>(`ai_memory_${userId}`, {
          expiryMinutes: 60
        });
        
        if (cached) {
          console.log(`🤖 Using cached AI memory (${Object.keys(cached).length} entries)`);
          return cached;
        }
        
        // Cache miss - load from Firebase and cache
        console.log('🤖 Cache miss - loading AI memory from Firebase...');
        const aiMemory = await firebaseService.getAllAIMemory(userId);
        
        await cacheService.setCache(`ai_memory_${userId}`, aiMemory, {
          expiryMinutes: 60
        });
        
        return aiMemory;
      } catch (error) {
        logError('AIService.loadAllAIMemory', error);
        return {};
      }
    }

    // Check AI memory for a description
    private async checkAIMemory(description: string, userId: string, allAIMemory?: { [hash: string]: string }): Promise<string | null> {
      try {
        const hash = this.generateDescriptionHash(description);
        
        // Use provided AI memory or load from cache
        const aiMemory = allAIMemory || await this.loadAllAIMemory(userId);
        const category = aiMemory[hash];
        
        if (category) {
          console.log(`🤖 AI memory: "${description}" → ${category}`);
          return category;
        }
        return null;
      } catch (error) {
        logError('AIService.checkAIMemory', error);
        return null;
      }
    }

    // Clear AI memory cache when memory changes
    async clearAIMemoryCache(userId: string): Promise<void> {
      await cacheService.removeCache(`ai_memory_${userId}`);
      console.log('🗑️ Cleared AI memory cache');
    }

    // Save successful AI result to memory
    private async saveToAIMemory(userId: string, description: string, category: string): Promise<void> {
      try {
        await firebaseService.saveAIMemory(userId, description, category);
        // Clear cache to force reload next time
        await this.clearAIMemoryCache(userId);
      } catch (error) {
        logError('AIService.saveToAIMemory', error);
      }
    }

    // Clear user rules cache (when rules change)
    async clearUserRulesCache(userId: string): Promise<void> {
      await cacheService.removeCache(`user_rules_${userId}`);
      console.log('🗑️ Cleared user rules cache');
    }
    // Check if there is a user defined rule in cache-first, the above was commented out which checks the firebase first
    private async checkUserRules(description: string, userId: string, allUserRules?: { [hash: string]: string }): Promise<string | null> {
      try {
        const hash = this.generateDescriptionHash(description);
        
        // Use provided rules or load from cache
        const userRules = allUserRules || await this.loadAllUserRules(userId);
        const category = userRules[hash];
        
        if (category) {
          console.log(`✅ User rule: "${description}" → ${category}`);
          return category;
        }
        return null;
      } catch (error) {
        logError('AIService.checkUserRules', error);
        return null;
      }
    }

  // Hash descriptions for user rules
  private generateDescriptionHash(description: string): string {
    const normalized = description.trim().toLowerCase();
    return CryptoJS.MD5(normalized).toString();
  }

  async categorizeTransactionsHybrid(descriptions: string[], userId: string): Promise<string[]> {
  console.log(`Starting hybrid categorization for ${descriptions.length} transactions`);
  
  /** 
  // STEP 1: Check user rules first in the firebase
  const finalResults: string[] = new Array(descriptions.length);
  const needsProcessing: number[] = [];
  const needsProcessingDescs: string[] = [];

  for (let i = 0; i < descriptions.length; i++) {
    const description = descriptions[i];
    
    // Check user rules first
    const userRule = await this.checkUserRules(description, userId);
    if (userRule) {
      finalResults[i] = userRule;
      continue;
    }
    */

    // STEP 1: Load all user rules once
  const allUserRules = await this.loadAllUserRules(userId);
  const allAIMemory = await this.loadAllAIMemory(userId);
  
  // Check user rules first
  const finalResults: string[] = new Array(descriptions.length);
  const needsProcessing: number[] = [];
  const needsProcessingDescs: string[] = [];

  for (let i = 0; i < descriptions.length; i++) {
    const description = descriptions[i];
    
    // Check user rules using loaded rules
    const userRule = await this.checkUserRules(description, userId, allUserRules);
    if (userRule) {
      finalResults[i] = userRule;
      continue;
    }

     // Then check AI memory for rules
    const aiMemoryResult = await this.checkAIMemory(description, userId, allAIMemory);
    if (aiMemoryResult) {
      finalResults[i] = aiMemoryResult;
      continue;
    }

    // If other transactions still needs processing
    needsProcessing.push(i);
    needsProcessingDescs.push(description);
  }

  console.log(`🧠 User rules: ${descriptions.length - needsProcessingDescs.length - Object.keys(allAIMemory).length} found`);
  console.log(`🤖 AI memory: Additional matches found`);
  console.log(`⚡ Need processing: ${needsProcessingDescs.length}`);

  // If everything was found in user rules, then that's it, done
  if (needsProcessingDescs.length === 0) {
    return finalResults;
  } 

    
  // STEP 2: Check batch cache for remaining transactions
  const batchCacheKey = this.generateBatchCacheKey(needsProcessingDescs);
  const cachedBatchResult = await cacheService.getCache<string[]>(batchCacheKey, {
    expiryMinutes: 2
  });
  
  if (cachedBatchResult) {
    console.log('✅ Found cached batch results for remaining transactions');
    // Merge cached results back into final results
    needsProcessing.forEach((originalIndex, i) => {
      finalResults[originalIndex] = cachedBatchResult[i];
    });
    return finalResults;
  }
  
  // STEP 3: Run keyword matching on remaining transactions
  const keywordResults = needsProcessingDescs.map(desc => 
    this.comprehensiveFallbackCategorization(desc)
  );
  
  // STEP 4: Find transactions that still need AI (not sorted by the above)
  const unclearIndices: number[] = [];
  const unclearDescriptions: string[] = [];
  
  keywordResults.forEach((result, index) => {
    if (result === 'Miscellaneous') {
      unclearIndices.push(index);
      unclearDescriptions.push(needsProcessingDescs[index]);
    }
  });
  
  console.log(`Keyword matching: ${needsProcessingDescs.length - unclearDescriptions.length} categorized, ${unclearDescriptions.length} need AI`);
  
  // STEP 5: Check individual cache for unclear transactions
  const finalUnclearIndices: number[] = [];
  const finalUnclearDescriptions: string[] = [];
  
  for (let i = 0; i < unclearDescriptions.length; i++) {
    const description = unclearDescriptions[i];
    const cacheKey = this.generateCacheKey(description);
    const cachedResult = await cacheService.getCache<string>(cacheKey, {
      expiryMinutes: 24 * 60 // 24 hours
    });
    
    if (cachedResult) {
      // Use cached individual result
      const originalIndex = unclearIndices[i];
      keywordResults[originalIndex] = cachedResult;
      console.log(`Individual cache hit for: ${description.substring(0, 20)}`);
    } else {
      // Still needs AI processing
      finalUnclearIndices.push(unclearIndices[i]);
      finalUnclearDescriptions.push(description);
    }
  }
  
  // STEP 6: Process final unclear transactions with AI
  if (finalUnclearDescriptions.length > 0) {
    try {
      console.log('\n🤖 Sending to AI for categorization:');
      finalUnclearDescriptions.forEach((desc, index) => {
        console.log(`  ${index + 1}. "${desc}"`);
      });
      
      const aiResults = await this.categorizeTransactions(finalUnclearDescriptions);
      
      console.log('\n✅ AI Categorization Results:');
      
      // Merge AI results back into keyword results
      finalUnclearIndices.forEach((originalIndex, aiIndex) => {
      const description = finalUnclearDescriptions[aiIndex];
      const category = aiResults[aiIndex];
      keywordResults[originalIndex] = category;
      
      console.log(`  "${description}" → ${category}`);
      
      // Save to AI memory (fire-and-forget)
      this.saveToAIMemory(userId, description, category).catch(error => {
        console.log('Failed to save AI result to memory:', error);
      });
    });
      
      console.log(`\n🎯 AI processing completed: ${finalUnclearDescriptions.length} transactions categorized`);
    } catch (error) {
      console.log('AI processing failed, keeping keyword results for unclear transactions');
      logError('AIService.categorizeTransactionsHybrid', error);
    }
  }
  
  // Cache the results for remaining transactions
  await cacheService.setCache(batchCacheKey, keywordResults, {
    expiryMinutes: 2
  });
  console.log('💾 Cached batch results for 2 minutes');
  
  // Merge processed results back into final results
  needsProcessing.forEach((originalIndex, i) => {
    finalResults[originalIndex] = keywordResults[i];
  });

  console.log('\n📊 Categorization Summary:');
  const categoryCounts = finalResults.reduce((acc, category) => {
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as { [key: string]: number });

  Object.entries(categoryCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([category, count]) => {
      console.log(`  ${category}: ${count} transactions`);
    });
      
  return finalResults;
}

  
}

export const aiService = new AIService();