import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { NavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import { registerAndSavePushToken } from './src/lib/notifications';

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<Record<string, object | undefined>>>(null);

  useEffect(() => {
    // Register for push notifications on every launch (idempotent)
    void registerAndSavePushToken();

    // Handle notification taps: navigate to Calendar tab
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      navigationRef.current?.navigate('Calendar');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <>
      <AppNavigator navigationRef={navigationRef} />
      <StatusBar style="auto" />
    </>
  );
}
