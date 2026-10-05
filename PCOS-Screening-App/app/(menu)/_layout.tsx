// app/(menu)/_layout.tsx
/**
 * Secondary screens, reached from the menu rather than the tab bar.
 *
 * Every screen renders its own <ScreenHeader />, so the native header stays
 * off throughout. Previously some screens used the native header and others
 * rolled their own, which is why the chrome changed as you moved around.
 *
 * Routes are discovered from the filesystem — listing them here by hand is
 * what allowed `medication-tracker` (no such file) and `profile` (the file
 * was `Profile.tsx`) to drift out of sync with reality.
 */

import { Stack } from "expo-router";

export default function MenuLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Forward navigation slides in from the right on both platforms.
        animation: "slide_from_right",
      }}
    />
  );
}
