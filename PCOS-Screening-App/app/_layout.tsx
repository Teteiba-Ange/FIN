// app/_layout.tsx
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../context/authContext";
import { AssessmentProvider } from "../context/assessmentContext";
import { useNotificationListeners } from "../utils/notifications";

function AppNavigator() {
  useEffect(() => {
    const cleanup = useNotificationListeners();
    return cleanup;
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
    </Stack>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <AssessmentProvider>
          <AppNavigator />
        </AssessmentProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}