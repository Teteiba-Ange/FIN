// app/(drawer)/admin/moderation.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Button, StyleSheet, Alert } from 'react-native';
import { getCommunityPosts, saveCommunityPosts } from '../../../utils/storage';
import { useFocusEffect } from 'expo-router';

export default function AdminModerationScreen() {
  const [posts, setPosts] = useState<any[]>([]);

  const loadPosts = async () => {
    const stored = await getCommunityPosts();
    if (stored) setPosts(stored);
  };

  useFocusEffect(useCallback(() => { loadPosts(); }, []));

  const handleApprove = async (postId: string) => {
    const updated = posts.map(p =>
      p.id === postId ? { ...p, approved: true, reported: false } : p
    );
    await saveCommunityPosts(updated);
    setPosts(updated);
  };

  const handleDelete = async (postId: string) => {
    const updated = posts.filter(p => p.id !== postId);
    await saveCommunityPosts(updated);
    setPosts(updated);
  };

  const reportedPosts = posts.filter(p => p.reported === true && !p.approved);
  const pendingPosts = posts.filter(p => !p.approved && !p.reported);

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.postCard}>
      <Text style={styles.user}>{item.userName}</Text>
      <Text style={styles.title}>{item.title}</Text>
      <Text>{item.content}</Text>
      <View style={styles.actions}>
        <Button title="Approve" onPress={() => handleApprove(item.id)} />
        <Button title="Delete" color="red" onPress={() => handleDelete(item.id)} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Admin Moderation</Text>
      <Text style={styles.subheader}>Reported Posts</Text>
      {reportedPosts.length === 0 ? <Text>No reported posts</Text> : null}
      <FlatList data={reportedPosts} renderItem={renderItem} keyExtractor={item => item.id} />
      <Text style={styles.subheader}>Pending Approval</Text>
      {pendingPosts.length === 0 ? <Text>No pending posts</Text> : null}
      <FlatList data={pendingPosts} renderItem={renderItem} keyExtractor={item => item.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  subheader: { fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  postCard: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 12 },
  user: { fontWeight: 'bold' },
  title: { fontSize: 16, fontWeight: '600', marginVertical: 4 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
});