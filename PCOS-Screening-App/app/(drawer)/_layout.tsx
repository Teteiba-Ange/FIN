// app/(drawer)/_layout.tsx
import { Stack } from "expo-router";

export default function DrawerLayout() {
  return (
    <Stack>
      {/* ── Core screens ─────────────────────────────────────── */}
      <Stack.Screen name="drawer"              options={{ headerShown: false }} />
      <Stack.Screen name="profile"             options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile"        options={{ title: "Edit Profile" }} />
      

      {/* ── Health tracking ──────────────────────────────────── */}
      <Stack.Screen
  name="symptom-log"
  options={{
    headerShown: true,
    headerTitle: "Symptom Log",
    headerBackTitle: "Back",
  }}
/>
      <Stack.Screen name="cycle-tracker"       options={{ headerShown: false }} />
      <Stack.Screen name="symptom-trends"      options={{ headerShown: false }} />
      <Stack.Screen name="medication-tracker"  options={{ headerShown: false }} />

      {/* ── Wellbeing ────────────────────────────────────────── */}
      <Stack.Screen name="mental-wellbeing"    options={{ headerShown: false }} />

      {/*
        ── FR-16: Mindfulness — registered as a nested group ──
        The mindfulness folder has its OWN _layout.tsx so we
        register it here as a wildcard group with the bracket syntax.
        Expo Router will hand off routing to mindfulness/_layout.tsx
        for any path starting with mindfulness/...
      */}
      <Stack.Screen name="mindfulness"         options={{ headerShown: false }} />
      <Stack.Screen name="mindfulness/breathing"   options={{ headerShown: false }} />
      <Stack.Screen name="mindfulness/completion"  options={{ headerShown: false }} />
      <Stack.Screen name="mindfulness/history"     options={{ headerShown: false }} />

      {/* ── Content ──────────────────────────────────────────── */}
      <Stack.Screen name="wellness-library"    options={{ headerShown: false }} />

      {/* ── Community ────────────────────────────────────────── */}
      <Stack.Screen name="community-feed"      options={{ headerShown: false }} />
      <Stack.Screen name="create-post"         options={{ headerShown: false }} />

      {/* ── Settings / Admin ─────────────────────────────────── */}
      <Stack.Screen name="notification-settings" options={{ headerShown: false }} />
      
    </Stack>
  );
}