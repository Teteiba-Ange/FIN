import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { getMoodEntries, saveMoodEntries } from '../../utils/storage';

const MOODS = [
  { label: '😊 Happy', value: 5 },
  { label: '🙂 Okay', value: 4 },
  { label: '😐 Neutral', value: 3 },
  { label: '🙁 Sad', value: 2 },
  { label: '😢 Very Sad', value: 1 },
];

export default function MentalWellbeingScreen() {
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedMood, setSelectedMood] = useState(3);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    const stored = await getMoodEntries();
    if (stored) setEntries(stored);
  };

  const handleSave = async () => {
    const newEntry = {
      id: Date.now().toString(),
      mood: selectedMood,
      notes,
      date: new Date().toISOString(),
    };
    const updated = [newEntry, ...entries];
    await saveMoodEntries(updated);
    setEntries(updated);
    Alert.alert('Saved', 'Mood logged!');
    setNotes('');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Mental Wellbeing</Text>
      <Text style={styles.subtitle}>How are you feeling today?</Text>

      <View style={styles.moodContainer}>
        {MOODS.map((mood) => (
          <TouchableOpacity
            key={mood.value}
            style={[styles.moodButton, selectedMood === mood.value && styles.moodSelected]}
            onPress={() => setSelectedMood(mood.value)}
          >
            <Text style={styles.moodLabel}>{mood.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.textInput}
        multiline
        numberOfLines={3}
        placeholder="Add notes (optional)"
        value={notes}
        onChangeText={setNotes}
      />

      <Button title="Save Mood" onPress={handleSave} />

      <Text style={styles.subtitle}>Mood History</Text>
      {entries.slice(0, 5).map((entry) => (
        <View key={entry.id} style={styles.entryItem}>
          <Text>{new Date(entry.date).toLocaleDateString()} - Mood: {entry.mood}/5</Text>
          {entry.notes ? <Text>Notes: {entry.notes}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  moodContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', marginVertical: 12 },
  moodButton: { padding: 10, borderWidth: 1, borderColor: '#ccc', borderRadius: 20, margin: 4 },
  moodSelected: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  moodLabel: { fontSize: 16 },
  textInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 8, minHeight: 80, marginVertical: 12 },
  entryItem: { borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 8 },
});