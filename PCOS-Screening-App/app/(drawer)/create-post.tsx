import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { getCommunityPosts, saveCommunityPosts } from '../../utils/storage';
import { useRouter } from 'expo-router';

export default function CreatePostScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Error', 'Please fill in both fields');
      return;
    }
    const existing = await getCommunityPosts();
    const newPost = {
      id: Date.now().toString(),
      userId: 'user1', // replace with actual user
      userName: 'You',
      title,
      content,
      timestamp: Date.now(),
      likes: 0,
      comments: [],
      reported: false,
      approved: true, // or false if moderation needed
    };
    const updated = [newPost, ...(existing || [])];
    await saveCommunityPosts(updated);
    Alert.alert('Posted!', 'Your post is live.');
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Post title" />
      <Text style={styles.label}>Content</Text>
      <TextInput style={[styles.input, { minHeight: 120 }]} value={content} onChangeText={setContent} multiline placeholder="Share your experience..." />
      <Button title="Publish" onPress={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  label: { fontSize: 16, fontWeight: 'bold', marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 8, marginTop: 4 },
});