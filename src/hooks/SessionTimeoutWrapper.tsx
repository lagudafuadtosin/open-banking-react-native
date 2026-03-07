import React from 'react';
import { TouchableWithoutFeedback, View, ViewStyle } from 'react-native';
import { useAuth } from '../context/AuthContext';

interface SessionTimeoutWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

// Wraps content to detect user interaction and reset session timeout
export const SessionTimeoutWrapper = (props: SessionTimeoutWrapperProps) => {
  const { children, style } = props;
  const { resetSessionTimeout } = useAuth();

  // Any interaction inside this wrapper resets the session timer
  const handleUserInteraction = () => {
    console.log('User interaction detected in SessionTimeoutWrapper'); // Consider removing this, later
    resetSessionTimeout();
  };

  return (
    <TouchableWithoutFeedback 
      onPress={handleUserInteraction}
      onLongPress={handleUserInteraction}
      delayLongPress={100} // Slight delay to catch longer touches
    >
      <View 
        style={[{ flex: 1 }, style]} 
        onTouchStart={handleUserInteraction}
        onTouchMove={handleUserInteraction}
        onTouchEnd={handleUserInteraction}
      >
        {children}
      </View>
    </TouchableWithoutFeedback>
  );
};
