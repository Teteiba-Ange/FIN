// app/(menu)/menu.tsx
/**
 * The menu — every screen that isn't a tab destination.
 *
 * Replaces the old `drawer.tsx`, which was an "Assessment Analysis" screen
 * built on hardcoded chart data with a navigation list attached to the
 * bottom. Real trend data belongs on the Trends tab; this screen navigates.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Screen, ScreenHeader, Section, Card, ListRow, Text, Avatar } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { resolveAssetUrl } from "@/lib/api";
import { useTheme, spacing, radius } from "@/theme";

type MenuItem = {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

const TRACKING: MenuItem[] = [
  {
    label: "Symptom log",
    description: "Record how you're feeling day to day",
    icon: "create-outline",
    route: "/symptom-log",
  },
  {
    label: "Cycle tracker",
    description: "Log periods and spot patterns",
    icon: "calendar-outline",
    route: "/cycle-tracker",
  },
  {
    // Was "Doses, schedules and reminders". There are no medication reminders
    // — the daily reminder, cycle heads-up and weekly reading are the three
    // that exist, and they live in Settings. (C-01 in PLAN.md.)
    label: "Medications",
    description: "What you take, and whether you took it",
    icon: "medkit-outline",
    route: "/medication-tracking",
  },
];

const WELLBEING: MenuItem[] = [
  {
    label: "Mental wellbeing",
    description: "Track mood over time",
    icon: "heart-outline",
    route: "/mental-wellbeing",
  },
  {
    label: "Mindfulness",
    description: "Guided breathing exercises",
    icon: "leaf-outline",
    route: "/mindfulness",
  },
  {
    label: "Wellness library",
    description: "Reading on managing PCOS",
    icon: "book-outline",
    route: "/wellness-library",
  },
];

const ACCOUNT: MenuItem[] = [
  {
    label: "Edit profile",
    description: "Your details and health metrics",
    icon: "person-outline",
    route: "/edit-profile",
  },
  // Notifications used to be its own row pointing at a second screen that
  // controlled the same four switches as Settings, with different copy and a
  // redundant "Save Preferences" button. Settings owns them now. (E-07.)
  {
    label: "Settings",
    description: "Appearance, notifications and account",
    icon: "settings-outline",
    route: "/settings",
  },
];

export default function MenuScreen() {
  const router = useRouter();
  const { user, avatarVersion } = useAuth();
  const { colors } = useTheme();

  const renderGroup = (items: MenuItem[]) => (
    <Card padded={false} style={styles.group}>
      {items.map((item, index) => (
        <View key={item.route}>
          {index > 0 && (
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          )}
          <ListRow
            label={item.label}
            description={item.description}
            icon={item.icon}
            onPress={() => router.push(item.route as never)}
            style={styles.row}
          />
        </View>
      ))}
    </Card>
  );

  return (
    <Screen>
      <ScreenHeader title="Menu" />

      {/* Profile summary doubles as the entry point to the profile screen. */}
      <Card
        onPress={() => router.push("/profile")}
        accessibilityLabel={`Open profile for ${user?.fullName ?? "your account"}`}
        style={styles.profileCard}
      >
        <View style={styles.profileRow}>
          {/* Same component as the profile screen, so a changed photo shows
              here without a second copy of the fallback logic. */}
          <Avatar
            uri={resolveAssetUrl(user?.profilePicture, avatarVersion)}
            name={user?.fullName}
            size={46}
          />
          <View style={styles.profileText}>
            <Text variant="subhead" numberOfLines={1}>
              {user?.fullName ?? "Your profile"}
            </Text>
            <Text variant="callout" color="textSecondary" numberOfLines={1}>
              {user?.email ?? "Sign in to sync your data"}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textTertiary}
          />
        </View>
      </Card>

      <View style={styles.sections}>
        <Section title="Tracking">{renderGroup(TRACKING)}</Section>
        <Section title="Wellbeing">{renderGroup(WELLBEING)}</Section>
        <Section title="Account">{renderGroup(ACCOUNT)}</Section>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: { marginBottom: spacing.xl },
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  profileText: { flex: 1, gap: 1 },
  sections: { gap: spacing.xl },
  group: { paddingHorizontal: spacing.lg },
  row: { paddingVertical: spacing.sm },
  divider: { height: StyleSheet.hairlineWidth },
});
