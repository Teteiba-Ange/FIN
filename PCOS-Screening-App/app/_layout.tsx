// app/_layout.tsx
/**
 * Root layout: providers, the status bar, and the auth gate.
 *
 * Three things were wrong here before:
 *   - ThemeProvider was mounted twice (nested), so the toggle wrote to one
 *     instance while screens read the other
 *   - registerNotificationListeners was named `use…` and called as if it
 *     were a hook
 *   - the auth redirect lived in app/index.tsx, which meant that file and
 *     app/(tabs)/index.tsx both claimed the "/" route
 *
 * The gate now lives here, so "/" belongs unambiguously to the home tab.
 */

import React, { useEffect, useRef } from "react";
import { ActivityIndicator, AppState, View, StyleSheet } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/features/auth";
import { AssessmentProvider } from "@/features/assessment";
import { registerNotificationListeners } from "@/lib/notifications";
import { syncNow } from "@/lib/logs";
import { hasCurrentConsent } from "@/lib/consent";
import { ToastProvider } from "@/components/ui";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ThemeProvider, useTheme } from "@/theme";

/** Routes reachable without a session. */
const PUBLIC_ROUTES = ["login", "signup", "onboarding"];

function AppNavigator() {
  const { user, loading } = useAuth();
  const { colors, isDark, ready: themeReady } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const handledInitialRoute = useRef(false);

  // `null` while unknown, so the gate below doesn't route on a guess.
  const [consented, setConsented] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    hasCurrentConsent()
      .then(setConsented)
      // A failed read means unknown, and unknown means show onboarding. The
      // cost of asking twice is far lower than skipping consent entirely.
      .catch(() => setConsented(false));
  }, []);

  useEffect(() => registerNotificationListeners(), []);

  /**
   * Drain the write-ahead queue whenever the app comes back to the foreground.
   *
   * This is the main recovery path for entries logged with no connection: the
   * user saves something on a bus, the flush fails, and the next time they
   * open the app it goes out. Deliberately not a poll — there is nothing to
   * send most of the time, and `flush()` returns immediately on an empty queue.
   */
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      const returning = appState.current.match(/inactive|background/) && next === "active";
      appState.current = next;
      if (returning) {
        syncNow().catch(() => {
          /* Still queued; retried on the next foreground. */
        });
      }
    });
    return () => subscription.remove();
  }, []);

  // And once at startup, for anything left over from the previous session.
  useEffect(() => {
    if (!loading && user) {
      syncNow().catch(() => {});
    }
  }, [loading, user]);

  useEffect(() => {
    if (loading || consented === null) return;

    const route = segments[0] as string | undefined;
    if (!route) return;
    const onPublicRoute = PUBLIC_ROUTES.includes(route ?? "");

    if (user) {
      // Signed in — a returning user never sees onboarding again.
      const restoredMenuRoot = route === "(menu)" && segments[1] === "menu";
      if (!handledInitialRoute.current) {
        handledInitialRoute.current = true;
        if (onPublicRoute || restoredMenuRoot) router.replace("/");
      } else if (onPublicRoute) {
        router.replace("/");
      }
      return;
    }

    handledInitialRoute.current = true;

    // Signed out and has never agreed: onboarding, not the login form. It
    // carries the consent gate, so it must come before an account exists.
    if (!consented) {
      if (route !== "onboarding") router.replace("/onboarding");
      return;
    }

    if (!onPublicRoute) router.replace("/login");
  }, [user, loading, consented, segments, router]);

  // Hold the splash until the session, the theme and the consent record have
  // all resolved, so the app doesn't flash the wrong theme or the wrong screen.
  if (loading || !themeReady || consented === null) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack initialRouteName="(tabs)" screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {/*
          Inside ThemeProvider so the fallback screen can be themed, but
          outside everything else so a throw in any provider or screen is
          caught rather than white-screening the app. (B-07.)
        */}
        <AppErrorBoundary>
          <ToastProvider>
            <AuthProvider>
              <AssessmentProvider>
                <AppNavigator />
              </AssessmentProvider>
            </AuthProvider>
          </ToastProvider>
        </AppErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
});
