# Insights Mobile App

React Native mobile application for the Insights macroeconomic calendar.

## Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: React Navigation (Bottom Tabs)
- **Language**: TypeScript
- **Platform**: iOS and Android

## Prerequisites

- Node.js 18+ and npm
- Expo CLI (installed automatically when running commands)
- iOS Simulator (macOS with Xcode) or Android Emulator
- Expo Go app on your physical device (optional)

## Setup

1. **Install dependencies**:
   ```bash
   cd mobile
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm start
   # or
   npx expo start
   ```

3. **Run on specific platform**:
   ```bash
   # iOS (requires macOS)
   npm run ios
   
   # Android
   npm run android
   
   # Web
   npm run web
   ```

## Project Structure

```
mobile/
├── src/
│   ├── navigation/
│   │   └── AppNavigator.tsx    # Bottom tab navigation
│   └── screens/
│       ├── CalendarScreen.tsx  # Upcoming releases calendar
│       ├── WatchlistScreen.tsx # User's saved indicators
│       └── SettingsScreen.tsx  # App settings
├── assets/                     # Images and fonts
├── App.tsx                     # Root component
├── app.json                    # Expo configuration
├── package.json
└── README.md
```

## Available Screens

- **Calendar**: Displays upcoming economic releases (placeholder)
- **Watchlist**: Shows user's saved indicators (placeholder)
- **Settings**: App settings and preferences (placeholder)

## Navigation

The app uses React Navigation with a bottom tab navigator. Users can switch between Calendar, Watchlist, and Settings screens by tapping the tabs at the bottom of the screen.

## Development

### Running on iOS Simulator

1. Ensure you have Xcode installed on macOS
2. Run `npm run ios`
3. The iOS Simulator will launch automatically

### Running on Android Emulator

1. Ensure you have Android Studio installed with an Android emulator configured
2. Run `npm run android`
3. The Android emulator will launch automatically

### Running on Physical Device

1. Install the Expo Go app from the App Store (iOS) or Google Play (Android)
2. Run `npm start`
3. Scan the QR code with the Expo Go app

## Testing Navigation

After starting the app:

1. The app should load and display the Calendar screen by default
2. Tap the "Watchlist" tab to navigate to the Watchlist screen
3. Tap the "Settings" tab to navigate to the Settings screen
4. Tap the "Calendar" tab to return to the Calendar screen
5. Verify no crashes occur when navigating between screens

## Next Steps

Future features planned (see TASKS_L4.md):

- [ ] Magic link authentication with deep linking (T411)
- [ ] Calendar screen with release data and pull-to-refresh (T412)
- [ ] Watchlist management with add/remove functionality (T413)
- [ ] Push notifications for release alerts (T414)
- [ ] Indicator detail screen with charts (T415)

## Troubleshooting

### Metro bundler issues
```bash
# Clear cache and restart
npm start -- --clear
```

### iOS build issues
```bash
# Clean and rebuild
cd ios
pod deintegrate
pod install
cd ..
npm run ios
```

### Android build issues
```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npm run android
```

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Documentation](https://reactnative.dev/)
