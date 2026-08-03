// app/(tabs)/settings.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/authContext";

const TEAL = "#1f7a7a";
const TEAL_DARK = "#155555";
const TEAL_LIGHT = "#e6f4f4";

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  // Notification toggles (stored locally, but you can sync with storage/context)
  const [notifications, setNotifications] = useState({
    symptomReminder: true,
    medicationReminder: true,
    communityNotifications: true,
  });
  const [anonymousPosting, setAnonymousPosting] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: () => logout() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <TouchableOpacity style={styles.row} onPress={() => router.push("/profile")}>
            <Text style={styles.rowLabel}>Edit Profile</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Daily symptom reminder</Text>
            <Switch
              value={notifications.symptomReminder}
              onValueChange={(val) =>
                setNotifications((prev) => ({ ...prev, symptomReminder: val }))
              }
              trackColor={{ false: "#d1d5db", true: TEAL_LIGHT }}
              thumbColor={notifications.symptomReminder ? TEAL : "#9ca3af"}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Medication reminder</Text>
            <Switch
              value={notifications.medicationReminder}
              onValueChange={(val) =>
                setNotifications((prev) => ({ ...prev, medicationReminder: val }))
              }
              trackColor={{ false: "#d1d5db", true: TEAL_LIGHT }}
              thumbColor={notifications.medicationReminder ? TEAL : "#9ca3af"}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Community notifications</Text>
            <Switch
              value={notifications.communityNotifications}
              onValueChange={(val) =>
                setNotifications((prev) => ({ ...prev, communityNotifications: val }))
              }
              trackColor={{ false: "#d1d5db", true: TEAL_LIGHT }}
              thumbColor={notifications.communityNotifications ? TEAL : "#9ca3af"}
            />
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Anonymous posting</Text>
            <Switch
              value={anonymousPosting}
              onValueChange={setAnonymousPosting}
              trackColor={{ false: "#d1d5db", true: TEAL_LIGHT }}
              thumbColor={anonymousPosting ? TEAL : "#9ca3af"}
            />
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Dark Mode</Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: "#d1d5db", true: TEAL_LIGHT }}
              thumbColor={darkMode ? TEAL : "#9ca3af"}
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity style={styles.row} onPress={handleLogout}>
            <Text style={[styles.rowLabel, { color: "#ef4444" }]}>Logout</Text>
            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  backIcon: { fontSize: 22, color: TEAL, fontWeight: "700" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  container: { padding: 16 },
  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  rowLabel: { fontSize: 15, color: "#0f172a", fontWeight: "500" },
  rowArrow: { fontSize: 18, color: "#94a3b8", fontWeight: "600" },
});