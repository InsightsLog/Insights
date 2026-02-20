/**
 * Push notification helpers for the Insights mobile app (T512).
 *
 * Handles Expo push token registration, permission requests, and token
 * persistence in Supabase so the server can send release alerts via the
 * Expo Push API.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Configure notification behaviour while the app is foregrounded
// ---------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Request push permission and obtain the Expo push token.
 *
 * Returns the token string on success, or `null` if permission was denied or
 * an error occurred (errors are logged but not re-thrown).
 *
 * On Android, a notification channel is created before requesting the token
 * because Android 8+ requires a channel for notifications to appear.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    // Android: create a default notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Release Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#007AFF',
      });
    }

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      // Permission denied — graceful no-op
      console.log('Push notification permission not granted');
      return null;
    }

    // Retrieve the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (err) {
    console.warn('Failed to register for push notifications:', err);
    return null;
  }
}

/**
 * Save an Expo push token for the currently signed-in user.
 *
 * Uses an upsert so repeated calls (e.g. on every launch) are idempotent.
 * Returns `true` on success, `false` if there is no authenticated user or the
 * write fails.
 */
export async function saveExpoPushToken(token: string): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        token_type: 'expo',
        expo_token: token,
        // endpoint and keys are null for expo-type subscriptions
        endpoint: null,
        keys: null,
      },
      { onConflict: 'user_id,expo_token' }
    );

    if (error) {
      console.warn('Failed to save Expo push token:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Unexpected error saving Expo push token:', err);
    return false;
  }
}

/**
 * Register for push notifications and persist the token to Supabase.
 *
 * Combines `registerForPushNotificationsAsync` and `saveExpoPushToken`.
 * Safe to call on every app launch — idempotent.
 */
export async function registerAndSavePushToken(): Promise<void> {
  const token = await registerForPushNotificationsAsync();
  if (token) {
    await saveExpoPushToken(token);
  }
}
