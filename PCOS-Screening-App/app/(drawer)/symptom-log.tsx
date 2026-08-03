import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { getSymptomLogs, saveSymptomLogs } from "../../utils/storage";

const TEAL = "#1f7a7a";

const SYMPTOM_TYPES = [
  "Pain (pelvic/back)",
  "Fatigue",
  "Headache",
  "Nausea",
  "Acne",
  "Hair loss",
  "Irregular bleeding",
  "Mood swings",
];

export default function SymptomLogScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedSymptom, setSelectedSymptom] = useState(SYMPTOM_TYPES[0]);
  const [severity, setSeverity] = useState(3);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const stored = await getSymptomLogs();
    if (stored) setLogs(stored);
  };

  const handleSave = async () => {
    const newLog = {
      id: Date.now().toString(),
      symptom: selectedSymptom,
      severity,
      notes,
      date: date.toISOString(),
    };
    const updated = [newLog, ...logs];
    await saveSymptomLogs(updated);
    setLogs(updated);
    Alert.alert("Saved", "Symptom logged successfully!");
    setNotes("");
    setSeverity(3);
    setSelectedSymptom(SYMPTOM_TYPES[0]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ─── Custom Header with Back Button ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log Symptom</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.field}>
          <Text style={styles.label}>Symptom</Text>
          <Picker
            selectedValue={selectedSymptom}
            onValueChange={(item) => setSelectedSymptom(item)}
            style={styles.picker}
          >
            {SYMPTOM_TYPES.map((s) => (
              <Picker.Item key={s} label={s} value={s} />
            ))}
          </Picker>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Severity (1–5)</Text>
          <View style={styles.rating}>
            {[1, 2, 3, 4, 5].map((num) => (
              <TouchableOpacity
                key={num}
                style={[
                  styles.ratingButton,
                  severity === num && styles.ratingActive,
                ]}
                onPress={() => setSeverity(num)}
              >
                <Text style={styles.ratingText}>{num}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>
              {date.toLocaleDateString()}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add details…"
            placeholderTextColor="#94a3b8"
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Log</Text>
        </TouchableOpacity>

        <Text style={styles.subtitle}>Recent Logs</Text>
        {logs.slice(0, 5).map((log) => (
          <View key={log.id} style={styles.logItem}>
            <Text style={styles.logDate}>
              {new Date(log.date).toLocaleDateString()}
            </Text>
            <Text>
              {log.symptom} – Severity: {log.severity}
            </Text>
            {log.notes ? (
              <Text style={styles.logNotes}>Notes: {log.notes}</Text>
            ) : null}
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },

  // ─── Header ──────────────────────────────────────────
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

  // ─── Content ─────────────────────────────────────────
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scrollContent: { padding: 16, paddingBottom: 40 },

  title: { fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  subtitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 10,
    color: "#0f172a",
  },
  field: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: "600", color: "#334155", marginBottom: 6 },

  picker: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#fff",
  },

  rating: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 4,
  },
  ratingButton: {
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    width: 44,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  ratingActive: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  ratingText: {
    fontWeight: "700",
    color: "#334155",
  },

  dateButton: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
  },
  dateButtonText: { fontSize: 15, color: "#0f172a" },

  textInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    backgroundColor: "#fff",
    fontSize: 15,
    color: "#0f172a",
    textAlignVertical: "top",
  },

  saveButton: {
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  logItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  logDate: { fontWeight: "700", color: "#0f172a" },
  logNotes: { color: "#64748b", fontStyle: "italic", marginTop: 2 },
});