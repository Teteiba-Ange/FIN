// app/(drawer)/_layout.tsx
import { Stack } from "expo-router";

export default function DrawerLayout() {
  return (
    <Stack>
      <Stack.Screen name="drawer"         options={{ title: "Dashboard",      headerShown: false }} />
      <Stack.Screen name="edit-profile"   options={{ title: "Edit Profile" }} />
      <Stack.Screen name="profile"        options={{ headerShown: false }} />
      <Stack.Screen name="upload-reports" options={{ title: "Upload Reports" }} />
    </Stack>
  );
}