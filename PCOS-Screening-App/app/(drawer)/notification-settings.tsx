import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { getNotificationSettings, saveNotificationSettings } from '../../utils/storage';

const defaultSettings = {
  symptomReminder: true,
  cycleReminder: true,
  communityActivity: true,
  wellnessTips: false,
};

export default function NotificationSettingsScreen() {
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const stored = await getNotificationSettings();
    if (stored) setSettings(stored);
  };

  const toggleSwitch = async (key: keyof typeof settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    await saveNotificationSettings(newSettings);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification Settings</Text>
      {Object.keys(settings).map((key) => (
        <View key={key} style={styles.row}>
          <Text style={styles.label}>
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
          </Text>
          <Switch
            value={settings[key as keyof typeof settings]}
            onValueChange={() => toggleSwitch(key as keyof typeof settings)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' },
  label: { fontSize: 16 },
});