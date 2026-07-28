// app/(drawer)/notification-settings.tsx
import React, { useState, useEffect } from "react";
import {
  View, Text, Switch, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { saveNotificationSettings, getNotificationSettings } from "../../utils/storage";
import apiService from "../../context/apiService";

const TEAL      = "#1f7a7a";
const TEAL_DARK = "#155555";

type Settings = {
  symptomReminder:   boolean;
  cycleReminder:     boolean;
  communityActivity: boolean;
  wellnessTips:      boolean;
};

const DEFAULT_SETTINGS: Settings = {
  symptomReminder:   true,
  cycleReminder:     true,
  communityActivity: true,
  wellnessTips:      false,
};

const SETTINGS_CONFIG = [
  {
    key:         "symptomReminder" as keyof Settings,
    icon:        "🩺",
    title:       "Symptom Reminders",
    description: "Daily reminder at 8:00 AM to log your symptoms",
  },
  {
    key:         "cycleReminder" as keyof Settings,
    icon:        "🔄",
    title:       "Cycle Check-ins",
    description: "Fortnightly reminder to update your cycle tracker",
  },
  {
    key:         "communityActivity" as keyof Settings,
    icon:        "💬",
    title:       "Community Activity",
    description: "Alerts when someone replies to your posts",
  },
  {
    key:         "wellnessTips" as keyof Settings,
    icon:        "🌿",
    title:       "Weekly Wellness Tips",
    description: "Evidence-based PMOS wellness tips every Monday",
  },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Try backend first, fall back to local storage
      const local = await getNotificationSettings();
      setSettings(local);
    } catch {
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  };

  const toggleSwitch = async (key: keyof Settings) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);

    // Save locally immediately (optimistic update)
    await saveNotificationSettings(updated);

    // Save to backend in background
    try {
      await apiService.saveNotificationSettings(updated);
    } catch (err) {
      console.warn("[NOTIF] Backend save failed:", err);
      // Don't revert — local save succeeded
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await saveNotificationSettings(settings);
      await apiService.saveNotificationSettings(settings);
      Alert.alert("✅ Saved", "Your notification preferences have been updated.");
    } catch (err) {
      Alert.alert("Error", "Could not save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={TEAL} />
      </SafeAreaView>
    );
  }

  const activeCount = Object.values(settings).filter(Boolean).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Summary badge */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryIcon}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>
              {activeCount === 0
                ? "All notifications off"
                : `${activeCount} notification${activeCount > 1 ? "s" : ""} active`}
            </Text>
            <Text style={styles.summarySub}>
              Toggle the switches below to control what we send you
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>REMINDER SETTINGS</Text>

        <View style={styles.card}>
          {SETTINGS_CONFIG.map((item, index) => (
            <View key={item.key}>
              <View style={styles.settingRow}>
                {/* Icon */}
                <View style={styles.iconBox}>
                  <Text style={styles.itemIcon}>{item.icon}</Text>
                </View>

                {/* Text */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemDesc}>{item.description}</Text>
                </View>

                {/* Toggle */}
                <Switch
                  value={settings[item.key]}
                  onValueChange={() => toggleSwitch(item.key)}
                  trackColor={{ false: "#e5e7eb", true: "#a7d4d4" }}
                  thumbColor={settings[item.key] ? TEAL : "#9ca3af"}
                  ios_backgroundColor="#e5e7eb"
                />
              </View>
              {index < SETTINGS_CONFIG.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Info note */}
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            📱 Notifications are sent to your device based on Ghana time (WAT, GMT+0).
            You can change these settings at any time.
          </Text>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSaveAll}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save Preferences</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f7fa" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f7fa" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: TEAL_DARK,
  },
  backBtn:     { width: 40, height: 40, justifyContent: "center" },
  backIcon:    { fontSize: 22, color: "#fff", fontWeight: "700" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },

  container: { padding: 16 },

  summaryCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 14,
    marginBottom: 20, shadowColor: "#000",
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  summaryIcon:  { fontSize: 32 },
  summaryTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  summarySub:   { fontSize: 12, color: "#9ca3af", marginTop: 2 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#9ca3af",
    letterSpacing: 0.8, marginBottom: 10,
  },

  card: {
    backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 16,
    marginBottom: 16, shadowColor: "#000",
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },

  settingRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 16, gap: 12,
  },
  iconBox: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: "#f3f4f6",
    justifyContent: "center", alignItems: "center",
  },
  itemIcon:  { fontSize: 20 },
  itemTitle: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  itemDesc:  { fontSize: 12, color: "#9ca3af", marginTop: 2, lineHeight: 17 },

  divider: { height: 1, backgroundColor: "#f3f4f6" },

  noteBox: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    marginBottom: 20, borderLeftWidth: 4, borderLeftColor: TEAL,
  },
  noteText: { fontSize: 12, color: "#6b7280", lineHeight: 19 },

  saveBtn: {
    backgroundColor: TEAL, borderRadius: 12,
    paddingVertical: 15, alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});