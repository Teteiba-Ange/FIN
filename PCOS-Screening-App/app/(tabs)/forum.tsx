import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from "react-native";
import { useAuth } from "../../context/authContext";
import apiService from "../../context/apiService";

type Comment = {
  id: string;
  username: string;
  text: string;
  anonymous?: boolean;
};

type Post = {
  id: string;
  username: string;
  content: string;
  likes: number;
  anonymous?: boolean;
  comments: Comment[];
};

export default function ForumScreen() {
  const { user } = useAuth();
  const [postText, setPostText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiService.getPosts();
      setPosts(data);
    } catch (err: any) {
      setError(err?.message || "Unable to load community posts.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPost = async () => {
    if (!postText.trim()) return;
    if (!user) {
      Alert.alert("Login required", "Please sign in to post in the community.");
      return;
    }

    setSubmittingPost(true);
    try {
      await apiService.createPost(postText.trim(), anonymous);
      setPostText("");
      setAnonymous(false);
      await fetchPosts();
    } catch (err: any) {
      Alert.alert("Post failed", err?.message || "Unable to create post. Please try again.");
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleLike = async (id: string) => {
    try {
      const response = await apiService.likePost(id);
      setPosts((current) =>
        current.map((post) =>
          post.id === id ? { ...post, likes: response.likes } : post
        )
      );
    } catch (err: any) {
      Alert.alert("Like failed", err?.message || "Unable to like the post.");
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!commentText.trim()) return;
    if (!user) {
      Alert.alert("Login required", "Please sign in to add a comment.");
      return;
    }

    try {
      await apiService.addComment(postId, commentText.trim(), commentAnonymous);
      setCommentText("");
      setCommentAnonymous(false);
      await fetchPosts();
      setActiveCommentsPostId(postId);
    } catch (err: any) {
      Alert.alert("Comment failed", err?.message || "Unable to add comment. Please try again.");
    }
  };

  const toggleComments = (postId: string) => {
    setActiveCommentsPostId((current) =>
      current === postId ? null : postId
    );
  };

  const renderComment = (comment: Comment) => (
    <View style={styles.commentCard} key={comment.id}>
      <Text style={styles.commentAuthor}>
        {comment.anonymous ? "Anonymous" : comment.username}
      </Text>
      <Text style={styles.commentTextSmall}>{comment.text}</Text>
    </View>
  );

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Text style={styles.username}>
          {item.anonymous ? "🕶 Anonymous" : `👩 ${item.username}`}
        </Text>
        <Text style={styles.postMeta}>
          {item.comments.length} comments · {item.likes} likes
        </Text>
      </View>

      <Text style={styles.postContent}>{item.content}</Text>

      <View style={styles.postFooter}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLike(item.id)}
        >
          <Text style={styles.actionText}>❤️ Like</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => toggleComments(item.id)}
        >
          <Text style={styles.actionText}>💬 Comment</Text>
        </TouchableOpacity>
      </View>

      {activeCommentsPostId === item.id && (
        <View style={styles.commentSection}>
          {item.comments.length > 0 ? (
            item.comments.map(renderComment)
          ) : (
            <Text style={styles.emptyComments}>
              Start the conversation with a helpful reply.
            </Text>
          )}

          <TextInput
            placeholder="Write a reply..."
            value={commentText}
            onChangeText={setCommentText}
            multiline
            style={styles.commentInput}
          />

          <View style={styles.commentActionRow}>
            <TouchableOpacity
              style={[
                styles.commentToggle,
                commentAnonymous && styles.activeCommentToggle,
              ]}
              onPress={() => setCommentAnonymous((current) => !current)}
            >
              <Text
                style={[
                  styles.commentToggleText,
                  commentAnonymous && styles.activeCommentToggleText,
                ]}
              >
                {commentAnonymous ? "Comment as Anonymous" : "Comment as You"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.commentSubmitButton}
              onPress={() => handleAddComment(item.id)}
            >
              <Text style={styles.commentSubmitText}>Post Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const feedHeader = () => (
    <View>
      <Text style={styles.header}>Community Feed</Text>
      <Text style={styles.subHeader}>
        Browse member posts, add your own, and join PCOS conversations.
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>24</Text>
          <Text style={styles.statLabel}>Active Posts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>12</Text>
          <Text style={styles.statLabel}>New Comments</Text>
        </View>
      </View>

      <View style={styles.createPostCard}>
        <Text style={styles.cardLabel}>Create a new post</Text>
        <TextInput
          placeholder="Share your thoughts..."
          value={postText}
          onChangeText={setPostText}
          multiline
          style={styles.input}
        />

        <TouchableOpacity
          style={styles.anonymousButton}
          onPress={() => setAnonymous((current) => !current)}
        >
          <Text style={[
            styles.anonymousText,
            anonymous && styles.activeAnonymousText,
          ]}
          >
            {anonymous ? "Posting Anonymously" : "Post Anonymously"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.postButton}
          onPress={handleAddPost}
        >
          <Text style={styles.postButtonText}>Create Post</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Latest Discussions</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={feedHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },

  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  header: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    color: "#111827",
  },

  subHeader: {
    color: "#6b7280",
    marginBottom: 18,
    fontSize: 15,
    lineHeight: 22,
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  statNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f7a7a",
    marginBottom: 6,
  },

  statLabel: {
    color: "#6b7280",
    fontSize: 13,
  },

  createPostCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 18,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },

  cardLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 10,
    fontWeight: "600",
  },

  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    padding: 14,
    textAlignVertical: "top",
    marginBottom: 14,
    backgroundColor: "#f9fafb",
  },

  anonymousButton: {
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#eef2f7",
    marginBottom: 14,
    alignItems: "center",
  },

  anonymousText: {
    color: "#374151",
    fontWeight: "600",
  },

  activeAnonymousText: {
    color: "#1f7a7a",
  },

  postButton: {
    backgroundColor: "#1f7a7a",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  postButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 14,
  },

  postCard: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 18,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },

  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  username: {
    fontWeight: "700",
    color: "#111827",
    fontSize: 15,
  },

  postMeta: {
    color: "#6b7280",
    fontSize: 13,
  },

  postContent: {
    fontSize: 15,
    lineHeight: 22,
    color: "#374151",
    marginBottom: 16,
  },

  postFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },

  actionText: {
    color: "#374151",
    fontWeight: "600",
  },

  commentSection: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },

  commentCard: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
  },

  commentAuthor: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  commentTextSmall: {
    color: "#4b5563",
    lineHeight: 20,
  },

  emptyComments: {
    color: "#6b7280",
    marginBottom: 12,
    fontSize: 14,
  },

  commentInput: {
    minHeight: 80,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
    textAlignVertical: "top",
  },

  commentActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  commentToggle: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },

  activeCommentToggle: {
    backgroundColor: "#1f7a7a",
    borderColor: "#1f7a7a",
  },

  commentToggleText: {
    color: "#374151",
    fontWeight: "600",
  },

  activeCommentToggleText: {
    color: "#fff",
  },

  commentSubmitButton: {
    backgroundColor: "#1f7a7a",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  commentSubmitText: {
    color: "#fff",
    fontWeight: "700",
  },
});