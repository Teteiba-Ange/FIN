// app/(drawer)/community-feed.tsx
import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, Alert, SafeAreaView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Animated,
} from "react-native";
import {
  getCommunityPosts, saveCommunityPosts, initCommunityPosts,
  CommunityPost,
} from "../../utils/storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../context/authContext";

const TEAL       = "#1f7a7a";
const TEAL_LIGHT = "#e6f4f4";
const TEAL_DARK  = "#155555";
const PINK       = "#ec4899";

// ─── Animated Like Button ─────────────────────────────────────
const LikeButton = ({ liked, count, onPress }: { liked: boolean; count: number; onPress: () => void }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, useNativeDriver: true, speed: 40 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40 }),
    ]).start();
    onPress();
  };
  return (
    <TouchableOpacity onPress={handlePress} style={styles.actionBtn}>
      <Animated.Text style={[styles.actionIcon, { transform: [{ scale }] }]}>
        {liked ? "❤️" : "🤍"}
      </Animated.Text>
      <Text style={[styles.actionCount, liked && { color: PINK }]}>{count}</Text>
    </TouchableOpacity>
  );
};

// ─── Single Post Card ─────────────────────────────────────────
const PostCard = ({
  item, currentUser, onLike, onComment, onReport, onDelete,
}: {
  item: CommunityPost;
  currentUser: string;
  onLike: (id: string) => void;
  onComment: (id: string, text: string) => void;
  onReport: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const [expanded, setExpanded]   = useState(false);
  const [commentText, setComment] = useState("");
  const [liked, setLiked]         = useState(false);
  const isOwner = item.userName === currentUser;

  const submitComment = () => {
    if (!commentText.trim()) return;
    onComment(item.id, commentText.trim());
    setComment("");
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 60)   return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)   return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <View style={styles.postCard}>
      {/* Header */}
      <View style={styles.postHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {item.userName === "Anonymous" ? "?" : item.userName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.postUser}>{item.userName}</Text>
          <Text style={styles.postTime}>{timeAgo(item.timestamp)}</Text>
        </View>
        {isOwner && (
          <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>🗑</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {item.title ? <Text style={styles.postTitle}>{item.title}</Text> : null}
      <Text style={styles.postContent}>{item.content}</Text>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <LikeButton
          liked={liked}
          count={item.likes}
          onPress={() => { setLiked(!liked); onLike(item.id); }}
        />
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setExpanded((e) => !e)}
        >
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{item.comments.length}</Text>
        </TouchableOpacity>
        {!isOwner && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => onReport(item.id)}>
            <Text style={[styles.actionIcon, { fontSize: 14 }]}>🚩</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Comments section */}
      {expanded && (
        <View style={styles.commentSection}>
          {item.comments.map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <View style={styles.commentDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.commentUser}>{c.userName}</Text>
                <Text style={styles.commentText}>{c.text}</Text>
              </View>
            </View>
          ))}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment…"
              placeholderTextColor="#9ca3af"
              value={commentText}
              onChangeText={setComment}
              onSubmitEditing={submitComment}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !commentText.trim() && { opacity: 0.4 }]}
              onPress={submitComment}
              disabled={!commentText.trim()}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────
export default function CommunityFeedScreen() {
  const router      = useRouter();
  const { user }    = useAuth();
  const currentUser = user?.fullName || "You";

  const [posts,   setPosts]   = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<"all" | "mine">("all");

  // ── FIX 1: useFocusEffect + useCallback correctly typed ──
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        await initCommunityPosts();                // FIX 2: initCommunityPosts is now defined
        const stored = await getCommunityPosts();  // FIX 3: getCommunityPosts is now defined
        if (active) {
          setPosts(stored.filter((p) => p.approved));
          setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [])
  );

  const persist = async (updated: CommunityPost[]) => {
    await saveCommunityPosts(updated);
    setPosts(updated.filter((p) => p.approved));
  };

  const handleLike = async (postId: string) => {
    const all = await getCommunityPosts();
    const updated = all.map((p) =>
      p.id === postId ? { ...p, likes: p.likes + 1 } : p
    );
    await persist(updated);
  };

  const handleComment = async (postId: string, text: string) => {
    const all = await getCommunityPosts();
    const newComment = {
      id: Date.now().toString(),
      userName: currentUser,
      text,
      timestamp: Date.now(),
    };
    const updated = all.map((p) =>
      p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p
    );
    await persist(updated);
  };

  const handleReport = async (postId: string) => {
    Alert.alert("Report Post", "Are you sure you want to report this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: async () => {
          const all = await getCommunityPosts();
          const updated = all.map((p) =>
            p.id === postId ? { ...p, reported: true, approved: false } : p
          );
          await persist(updated);
          Alert.alert("Reported", "This post has been flagged for review.");
        },
      },
    ]);
  };

  const handleDelete = async (postId: string) => {
    Alert.alert("Delete Post", "Delete this post permanently?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const all = await getCommunityPosts();
          await persist(all.filter((p) => p.id !== postId));
        },
      },
    ]);
  };

  const displayed = filter === "mine"
    ? posts.filter((p) => p.userName === currentUser)
    : posts;

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={TEAL} />
        <Text style={{ color: "#9ca3af", marginTop: 12 }}>Loading forum…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Community Forum</Text>
            <Text style={styles.headerSub}>{posts.length} posts · Share & support</Text>
          </View>
          <TouchableOpacity
            style={styles.newPostBtn}
            onPress={() => router.push("/create-post" as any)}
          >
            <Text style={styles.newPostBtnText}>+ Post</Text>
          </TouchableOpacity>
        </View>

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          {(["all", "mine"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                {f === "all" ? "All Posts" : "My Posts"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard
              item={item}
              currentUser={currentUser}
              onLike={handleLike}
              onComment={handleComment}
              onReport={handleReport}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptySub}>Be the first to share your experience</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push("/create-post" as any)}
              >
                <Text style={styles.emptyBtnText}>Create First Post</Text>
              </TouchableOpacity>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:   { flex: 1, backgroundColor: "#f5f7fa" },
  centered:   { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f7fa" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: TEAL_DARK,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  newPostBtn: {
    backgroundColor: "#fff", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  newPostBtnText: { color: TEAL_DARK, fontWeight: "700", fontSize: 13 },

  filterRow: {
    flexDirection: "row", backgroundColor: "#fff",
    paddingHorizontal: 16, paddingVertical: 10, gap: 10,
    borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  filterTab: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, backgroundColor: "#f3f4f6",
  },
  filterTabActive:     { backgroundColor: TEAL_LIGHT },
  filterTabText:       { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  filterTabTextActive: { color: TEAL },

  postCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    marginBottom: 14, shadowColor: "#000",
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  postHeader:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  avatarCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: TEAL, justifyContent: "center", alignItems: "center",
  },
  avatarText:  { color: "#fff", fontWeight: "700", fontSize: 15 },
  postUser:    { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  postTime:    { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  deleteBtn:   { padding: 6 },
  deleteBtnText: { fontSize: 16 },

  postTitle:   { fontSize: 15, fontWeight: "700", color: "#1a1a1a", marginBottom: 6 },
  postContent: { fontSize: 14, color: "#374151", lineHeight: 21, marginBottom: 12 },

  actionsRow: { flexDirection: "row", gap: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  actionBtn:  { flexDirection: "row", alignItems: "center", gap: 5 },
  actionIcon: { fontSize: 18 },
  actionCount:{ fontSize: 13, color: "#6b7280", fontWeight: "600" },

  commentSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  commentRow:     { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 },
  commentDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL, marginTop: 6 },
  commentUser:    { fontSize: 12, fontWeight: "700", color: "#1a1a1a" },
  commentText:    { fontSize: 13, color: "#374151", lineHeight: 19, marginTop: 2 },

  commentInputRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  commentInput: {
    flex: 1, backgroundColor: "#f3f4f6", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
    fontSize: 13, color: "#1a1a1a",
  },
  sendBtn:     { backgroundColor: TEAL, borderRadius: 20, paddingHorizontal: 16, justifyContent: "center" },
  sendBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  emptyBox:   { alignItems: "center", paddingVertical: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 6 },
  emptySub:   { fontSize: 14, color: "#9ca3af", marginBottom: 20 },
  emptyBtn:   { backgroundColor: TEAL, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});