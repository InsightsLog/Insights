import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import CalendarScreen from '../screens/CalendarScreen';
import WatchlistScreen from '../screens/WatchlistScreen';
import AlertsScreen from '../screens/AlertsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#8E8E93',
        }}
      >
        <Tab.Screen 
          name="Calendar" 
          component={CalendarScreen}
          options={{
            title: 'Calendar',
          }}
        />
        <Tab.Screen 
          name="Watchlist" 
          component={WatchlistScreen}
          options={{
            title: 'Watchlist',
          }}
        />
        <Tab.Screen
          name="Alerts"
          component={AlertsScreen}
          options={{
            title: 'Alerts',
          }}
        />
        <Tab.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{
            title: 'Settings',
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
