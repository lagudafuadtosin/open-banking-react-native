import { Alert } from 'react-native';

/**
 * Extracts a readable error message from any type of error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || 'An unknown error occurred');
}

/**
 * Shows an alert with the error message
 */
export function showErrorAlert(title: string, error: unknown): void {
  const message = getErrorMessage(error);
  Alert.alert(title, message);
}

/**
 * Logs an error to console with appropriate formatting, sanitizing sensitive data
 */
export function logError(context: string, error: unknown, additionalInfo: any = {}): void {
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

  console.error(`[${context}] Error: ${JSON.stringify(sanitizedError)}`, errorDetails);

  // Optionally send to a secure logging service (e.g., Sentry)
  // Sentry.captureException(sanitizedError, { tags: { context } });
}