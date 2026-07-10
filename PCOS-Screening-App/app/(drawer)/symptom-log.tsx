import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Button, StyleSheet, ScrollView, Alert,
  TouchableOpacity
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { getSymptomLogs, saveSymptomLogs } from '../../utils/storage';

const SYMPTOM_TYPES = [
  'Pain (pelvic/back)',
  'Fatigue',
  'Headache',
  'Nausea',
  'Acne',
  'Hair loss',
  'Irregular bleeding',
  'Mood swings',
];

export default function SymptomLogScreen() {
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedSymptom, setSelectedSymptom] = useState(SYMPTOM_TYPES[0]);
  const [severity, setSeverity] = useState(3);
  const [notes, setNotes] = useState('');
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
    Alert.alert('Saved', 'Symptom logged successfully!');
    setNotes('');
    setSeverity(3);
    setSelectedSymptom(SYMPTOM_TYPES[0]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Log Symptom</Text>

      <View style={styles.field}>
        <Text>Symptom</Text>
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
        <Text>Severity (1-5)</Text>
        <View style={styles.rating}>
          {[1,2,3,4,5].map((num) => (
            <TouchableOpacity
              key={num}
              style={[styles.ratingButton, severity === num && styles.ratingActive]}
              onPress={() => setSeverity(num)}
            >
              <Text style={styles.ratingText}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text>Date</Text>
        <Button title={date.toLocaleDateString()} onPress={() => setShowDatePicker(true)} />
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
        <Text>Notes</Text>
        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add details..."
        />
      </View>

      <Button title="Save Log" onPress={handleSave} />

      <Text style={styles.subtitle}>Recent Logs</Text>
      {logs.slice(0, 5).map((log) => (
        <View key={log.id} style={styles.logItem}>
          <Text style={styles.logDate}>{new Date(log.date).toLocaleDateString()}</Text>
          <Text>{log.symptom} - Severity: {log.severity}</Text>
          {log.notes ? <Text style={styles.logNotes}>Notes: {log.notes}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  field: { marginBottom: 16 },
  picker: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4 },
  rating: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  ratingButton: { padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#ccc', width: 40, alignItems: 'center' },
  ratingActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  ratingText: { fontWeight: 'bold' },
  textInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 8, minHeight: 80 },
  logItem: { borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 8 },
  logDate: { fontWeight: 'bold' },
  logNotes: { color: '#666', fontStyle: 'italic' },
});