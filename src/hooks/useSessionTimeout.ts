// Very messy, try and clean up later

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';


export const useSessionTimeout = (
  onTimeout: () => void,
  timeoutDuration: number = 10 * 60 * 1000 // 5 minutes in milliseconds
) => {
  // Ref to the timeout timer
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to track the time of last user activity
  const lastActivityRef = useRef(Date.now());
  // Track if we've already initialized to prevent multiple logs which stopped from loading
  const initializedRef = useRef(false);
  
  // Function to reset the timeout timer
  const resetTimeout = useCallback(() => {
    console.log('resetTimeout called in useSessionTimeout hook');
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Update the last activity timestamp
    lastActivityRef.current = Date.now();
    console.log('Last activity time updated:', new Date(lastActivityRef.current).toISOString());
    
    // Set a new timeout
    timeoutRef.current = setTimeout(() => {
      // Calculate time since last activity
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      console.log('Time since last activity:', timeSinceLastActivity, 'ms');
      
      if (timeSinceLastActivity >= timeoutDuration) {
        console.log('Timeout threshold reached, triggering onTimeout');
        onTimeout();
      } else {
        console.log('Activity detected during timeout wait, resetting timer');
        // If activity occurred during timeout wait, reset timer
        resetTimeout();
      }
    }, timeoutDuration);
  }, [onTimeout, timeoutDuration]);
  
  // Function to handle user activity
  const handleActivity = useCallback(() => {
    resetTimeout();
  }, [resetTimeout]);
  
  // Set up the timeout when the component mounts
  useEffect(() => {
    // Only log on first initialization
    if (!initializedRef.current) {
      console.log('Session timeout initialized with duration:', timeoutDuration, 'ms');
      initializedRef.current = true;
    }
    
    // Initial timeout setup
    resetTimeout();
    
    // Listen for app state changes
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        console.log('App became active, resetting timeout');
        handleActivity();
      }
    });
    
    // Cleanup on unmount
    return () => {
      // Only log cleanup if we're still initialized
      if (initializedRef.current) {
        console.log('Cleaning up session timeout');
        initializedRef.current = false;
      }
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      subscription.remove();
    };
  }, [resetTimeout, handleActivity]);
  
  return { resetTimeout: handleActivity };
};