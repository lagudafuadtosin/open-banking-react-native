import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export const useSessionTimeout = (
  onTimeout: () => void,
  timeoutDuration: number = 15 * 60 * 1000 // 15 minutes in milliseconds
) => {
  // Change the type to accommodate NodeJS.Timeout
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());

  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity >= timeoutDuration) {
        onTimeout();
      }
    }, timeoutDuration);
  };

  const handleActivity = () => {
    lastActivityRef.current = Date.now();
    resetTimeout();
  };

  useEffect(() => {
    // Initial timeout setup
    resetTimeout();

    // Listen for app state changes to detect user activity
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        handleActivity();
      }
    });

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      subscription.remove();
    };
  }, []);

  return { resetTimeout: handleActivity };
};