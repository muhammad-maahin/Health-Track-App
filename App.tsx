// App.tsx - Enhanced Version with TypeScript Types
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// Import screens
import SplashScreen from "./src/screens/SplashScreen";
import ScanConnectScreen from "./src/screens/ScanConnectScreen";
import LiveDashboardScreen from "./src/screens/LiveDashboardScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

// Define navigation types for better TypeScript support
export type RootStackParamList = {
  Splash: undefined;
  ScanConnect: undefined;
  LiveDashboard: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          // Optional: Add consistent screen transitions
          animation: 'slide_from_right',
        }}
        initialRouteName="Splash"
      >
        {/* Initial splash screen */}
        <Stack.Screen 
          name="Splash" 
          component={SplashScreen}
          options={{
            // Optional: No back button on splash
            gestureEnabled: false,
          }}
        />

        {/* Scan & Connect Screen */}
        <Stack.Screen 
          name="ScanConnect" 
          component={ScanConnectScreen}
          options={{
            title: "Device Scanner", // For accessibility
          }}
        />

        {/* Live Dashboard Screen */}
        <Stack.Screen 
          name="LiveDashboard" 
          component={LiveDashboardScreen}
          options={{
            title: "Health Monitor", // For accessibility
          }}
        />

        {/* Settings Screen */}
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{
            title: "Settings", // For accessibility
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}