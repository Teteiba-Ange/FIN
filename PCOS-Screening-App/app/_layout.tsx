import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/authContext';
import { AssessmentProvider } from '../context/assessmentContext';

export default function Layout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AssessmentProvider>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="login" />
          </Stack>
        </AssessmentProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
