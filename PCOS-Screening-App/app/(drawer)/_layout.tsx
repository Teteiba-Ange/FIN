// app/(drawer)/_layout.tsx
import { Stack } from "expo-router";

export default function DrawerLayout() {
  return (
    <Stack>
      {/* Existing */}
      <Stack.Screen name="drawer"         options={{ title: "Dashboard",      headerShown: false }} />
      <Stack.Screen name="edit-profile"   options={{ title: "Edit Profile" }} />
      <Stack.Screen name="profile"        options={{ headerShown: false }} />
      <Stack.Screen name="upload-reports" options={{ title: "Upload Reports" }} />

      {/* NEW FEATURES */}
      <Stack.Screen name="symptom-log"        options={{ title: "Symptom Log" }} />
      <Stack.Screen name="cycle-tracker"      options={{ title: "Cycle Tracker" }} />
      <Stack.Screen name="symptom-trends"     options={{ title: "Symptom Trends" }} />
      <Stack.Screen name="mental-wellbeing"   options={{ title: "Mental Wellbeing" }} />
      <Stack.Screen name="wellness-library"   options={{ title: "Wellness Library" }} />
      <Stack.Screen name="community-feed"     options={{ title: "Community Forum" }} />
      <Stack.Screen name="create-post"        options={{ title: "Create Post" }} />
      <Stack.Screen name="notification-settings" options={{ title: "Notification Settings" }} />
      <Stack.Screen name="admin/moderation"   options={{ title: "Admin Moderation" }} />
    </Stack>
  );
}