import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Linking } from 'react-native';

const CONTENT = [
  {
    id: '1',
    category: 'Nutrition',
    title: 'Anti-inflammatory foods for PCOS',
    url: 'https://example.com/pcos-nutrition',
  },
  {
    id: '2',
    category: 'Exercise',
    title: 'Yoga for PCOS symptom relief',
    url: 'https://example.com/pcos-yoga',
  },
  {
    id: '3',
    category: 'Mental Health',
    title: 'Mindfulness and stress reduction',
    url: 'https://example.com/pcos-mindfulness',
  },
  {
    id: '4',
    category: 'Medical',
    title: 'Understanding Metformin for PCOS',
    url: 'https://example.com/pcos-metformin',
  },
];

export default function WellnessLibraryScreen() {
  const renderItem = ({ item }: { item: typeof CONTENT[0] }) => (
    <TouchableOpacity style={styles.card} onPress={() => Linking.openURL(item.url)}>
      <Text style={styles.category}>{item.category}</Text>
      <Text style={styles.title}>{item.title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Wellness Library</Text>
      <FlatList
        data={CONTENT}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  card: { padding: 16, backgroundColor: '#f9f9f9', borderRadius: 8, marginBottom: 12 },
  category: { fontWeight: 'bold', color: '#007AFF' },
  title: { fontSize: 16, marginTop: 4 },
});