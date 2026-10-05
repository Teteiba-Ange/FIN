// app/(tabs)/_layout.tsx
/**
 * Top-level navigation: four destinations.
 *
 * Profile moved to the menu — it is somewhere you visit occasionally, not a
 * peer of the daily-use screens. Community is the API-backed forum; the
 * device-local feed that used to sit alongside it has been removed.
 *
 * Tab labels stay visible. Icon-only navigation is a discoverability problem,
 * and these icons are not distinct enough to carry meaning on their own.
 */

import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, typography, radius } from "@/theme";

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { paddingBottom: 94, backgroundColor: colors.bg },
        tabBarBackground: () => null,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: "transparent",
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
          marginHorizontal: 14,
          bottom: 10,
          borderRadius: radius.lg,
          position: "absolute",
          shadowColor: "#2A1825",
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: typography.caption.fontSize,
          fontWeight: "700",
        },
        tabBarItemStyle: { borderRadius: radius.md },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="assess"
        options={{
          title: "Assess",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="health-trends"
        options={{
          title: "Trends",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trending-up-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="forum"
        options={{
          title: "Community",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Reachable by route, but not tab destinations. */}
      <Tabs.Screen name="assessment" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
