import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { getCycleEntries, saveCycleEntries } from '../../utils/storage';

export default function CycleTrackerScreen() {
  const [entries, setEntries] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [flow, setFlow] = useState('Medium');
  const [notes, setNotes] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    const stored = await getCycleEntries();
    if (stored) setEntries(stored);
  };

  const handleSave = async () => {
    const newEntry = {
      id: Date.now().toString(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      flow,
      notes,
    };
    const updated = [newEntry, ...entries];
    await saveCycleEntries(updated);
    setEntries(updated);
    Alert.alert('Saved', 'Cycle entry saved!');
    setNotes('');
    setFlow('Medium');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Track Cycle</Text>

      <View style={styles.field}>
        <Text>Start Date</Text>
        <Button title={startDate.toLocaleDateString()} onPress={() => setShowStartPicker(true)} />
        {showStartPicker && (
          <DateTimePicker value={startDate} mode="date" display="default" onChange={(e, d) => { setShowStartPicker(false); if (d) setStartDate(d); }} />
        )}
      </View>

      <View style={styles.field}>
        <Text>End Date</Text>
        <Button title={endDate.toLocaleDateString()} onPress={() => setShowEndPicker(true)} />
        {showEndPicker && (
          <DateTimePicker value={endDate} mode="date" display="default" onChange={(e, d) => { setShowEndPicker(false); if (d) setEndDate(d); }} />
        )}
      </View>

      <View style={styles.field}>
        <Text>Flow</Text>
        <Picker selectedValue={flow} onValueChange={setFlow} style={styles.picker}>
          <Picker.Item label="Light" value="Light" />
          <Picker.Item label="Medium" value="Medium" />
          <Picker.Item label="Heavy" value="Heavy" />
        </Picker>
      </View>

      <View style={styles.field}>
        <Text>Notes</Text>
        <TextInput style={styles.textInput} multiline numberOfLines={3} value={notes} onChangeText={setNotes} />
      </View>

      <Button title="Save Entry" onPress={handleSave} />

      <Text style={styles.subtitle}>Cycle History</Text>
      {entries.slice(0, 5).map((entry) => (
        <View key={entry.id} style={styles.entryItem}>
          <Text>Start: {new Date(entry.startDate).toLocaleDateString()}</Text>
          <Text>End: {new Date(entry.endDate).toLocaleDateString()}</Text>
          <Text>Flow: {entry.flow}</Text>
          {entry.notes ? <Text>Notes: {entry.notes}</Text> : null}
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
  textInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 8, minHeight: 80 },
  entryItem: { borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 8 },
});