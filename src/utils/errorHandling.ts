import { Alert } from 'react-native';

// Extracts a readable error message from any type of error

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || 'An unknown error occurred');
}

// Shows an alert with the error message
export function showErrorAlert(title: string, error: unknown): void {
  const message = getErrorMessage(error);
  Alert.alert(title, message);
}

// Logs an error to console with appropriate formatting, sanitizing sensitive data
 
/** export function logError(context: string, error: unknown, additionalInfo: any = {}): void {

  // Check if this is a CONSOLE_ONLY error that shouldn't trigger UI notifications
  const isConsoleOnlyError = context.includes('[CONSOLE_ONLY]');
  
  // To filter out specific service errors that shouldn't appear in UI
  const shouldSuppressUI = 
    isConsoleOnlyError || 
    context.includes('TrueLayerService') || 
    context.includes('OfflineContext') || 
    context.includes('SyncService');
  
  // Sanitize error object to remove sensitive data
  const sanitizedError = JSON.parse(JSON.stringify(error, (key, value) => {
    if (['accessToken', 'refreshToken', 'account_number', 'sort_code', 'account_holder_name', 'email', 'phone'].includes(key)) {
      return '***REDACTED***';
    }
    return value;
  }));
  
  // Combine error message with additional info
  const errorDetails = {
    message: getErrorMessage(error),
    ...additionalInfo,
  };
  
  // Use different console methods based on whether error should appear in UI
  if (shouldSuppressUI) {
    // Use console.debug which doesn't trigger UI notifications
    console.debug(`[${context}] Error: ${JSON.stringify(sanitizedError)}`, errorDetails);
  } else {
    // Regular console.error for normal errors
    console.error(`[${context}] Error: ${JSON.stringify(sanitizedError)}`, errorDetails);
  }
  
} **/

export function logError(context: string, error: unknown, additionalInfo: any = {}): void {
  // Simple console.log that will always show in Metro
  console.log(`[${context}] Error:`, error);
  
  if (additionalInfo && Object.keys(additionalInfo).length > 0) {
    console.log(`[${context}] Additional Info:`, additionalInfo);
  }
}