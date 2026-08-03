// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const TEAL = "#1f7a7a";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: TEAL }}>
      {/* 1. Points to app/(tabs)/index.tsx (previously HomeScreen) */}
      <Tabs.Screen
        name="index" 
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />

      {/* 2. Points to app/(tabs)/assess.tsx */}
      <Tabs.Screen
        name="assess"
        options={{
          title: "Assessment",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />

      {/* 3. Points to app/(tabs)/health-trends.tsx */}
      <Tabs.Screen
        name="health-trends"
        options={{
          title: "Health",
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" size={size} color={color} />,
        }}
      />

      {/* 4. Points to app/(tabs)/forum.tsx */}
      <Tabs.Screen
        name="forum"
        options={{
          title: "Forum",
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} />,
        }}
      />

      {/* 5. Points to app/(tabs)/profile.tsx */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      
      {/* Hide specific internal route folders from the tab bar */}
      <Tabs.Screen name="assessment" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ headerShown: false }} />
    </Tabs>
  );
}