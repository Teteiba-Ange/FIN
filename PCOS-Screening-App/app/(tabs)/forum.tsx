// app/(tabs)/forum.tsx
/**
 * Community.
 *
 * Rebuilt on the design system. Beyond the 41 hardcoded hex values, this
 * screen had four behavioural problems:
 *
 *   - It displayed "24 Active Posts" and "12 New Comments" as string
 *     literals. They read as live metrics, never changed, and showed on an
 *     empty forum. Both are now derived, or absent. (C-02 in PLAN.md.)
 *   - `loading`, `error` and `submittingPost` were all computed and none were
 *     ever rendered — lint had been flagging them as unused. A failed fetch
 *     showed an empty list indistinguishable from a quiet forum.
 *   - There was no pull-to-refresh and no empty state.
 *   - Every like and every comment refetched the entire feed. Likes are now
 *     optimistic and roll back on failure.
 *
 * Rows are memoised (`PostCard`) so typing a comment doesn't re-render every
 * post in the list.
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Platform, RefreshControl, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ScreenHeader,
  Card,
  Button,
  Field,
  Chip,
  Text,
  EmptyState,
  SkeletonRows,
  useToast,
} from "@/components/ui";
import { useAuth } from "@/features/auth";
import { apiService } from "@/lib/api";
import { useTheme, spacing, radius } from "@/theme";

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

const MAX_POST_LENGTH = 1000;

// ─── Post row ────────────────────────────────────────────────────────────────

type PostCardProps = {
  post: Post;
  liked: boolean;
  expanded: boolean;
  onToggleComments: (id: string) => void;
  onLike: (id: string) => void;
  onComment: (id: string, text: string, anonymous: boolean) => Promise<void>;
  canPost: boolean;
};

const PostCard = memo(function PostCard({
  post,
  liked,
  expanded,
  onToggleComments,
  onLike,
  onComment,
  canPost,
}: PostCardProps) {
  const { colors } = useTheme();
  const [reply, setReply] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [sending, setSending] = useState(false);

  const author = post.anonymous ? "Anonymous" : post.username;

  const submitReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await onComment(post.id, reply.trim(), anonymous);
      setReply("");
      setAnonymous(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card style={styles.post}>
      <View style={styles.postHead}>
        <View
          style={[styles.avatar, { backgroundColor: colors.sunken }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons
            name={post.anonymous ? "eye-off-outline" : "person-outline"}
            size={16}
            color={colors.textSecondary}
          />
        </View>
        <Text variant="bodyStrong" style={styles.author} numberOfLines={1}>
          {author}
        </Text>
      </View>

      <Text variant="body" color="textSecondary" style={styles.postBody}>
        {post.content}
      </Text>

      <View style={[styles.postActions, { borderTopColor: colors.border }]}>
        <Button
          label={
            liked
              ? `Liked · ${post.likes}`
              : post.likes === 1
                ? "1 like"
                : `${post.likes} likes`
          }
          onPress={() => onLike(post.id)}
          variant="ghost"
          size="sm"
          icon={liked ? "heart" : "heart-outline"}
          fullWidth={false}
          accessibilityLabel={
            liked
              ? `You liked this post. ${post.likes} likes so far.`
              : `Like this post. ${post.likes} likes so far.`
          }
        />
        <Button
          label={
            post.comments.length === 1 ? "1 reply" : `${post.comments.length} replies`
          }
          onPress={() => onToggleComments(post.id)}
          variant="ghost"
          size="sm"
          icon={expanded ? "chevron-up-outline" : "chatbubble-outline"}
          fullWidth={false}
          accessibilityLabel={`${expanded ? "Hide" : "Show"} replies. ${
            post.comments.length
          } so far.`}
        />
      </View>

      {expanded && (
        <View style={[styles.comments, { borderTopColor: colors.border }]}>
          {post.comments.length > 0 ? (
            post.comments.map((c) => (
              <View key={c.id} style={[styles.comment, { backgroundColor: colors.sunken }]}>
                <Text variant="caption" color="textSecondary">
                  {c.anonymous ? "Anonymous" : c.username}
                </Text>
                <Text variant="callout">{c.text}</Text>
              </View>
            ))
          ) : (
            <Text variant="callout" color="textTertiary" style={styles.noComments}>
              No replies yet. Yours would be the first.
            </Text>
          )}

          {canPost && (
            <View style={styles.replyBox}>
              <Field
                label="Your reply"
                placeholder="Share what helped you…"
                value={reply}
                onChangeText={setReply}
                multiline
                numberOfLines={2}
              />
              <View style={styles.replyActions}>
                <Chip
                  label="Post anonymously"
                  selected={anonymous}
                  onPress={() => setAnonymous((v) => !v)}
                />
                <Button
                  label="Reply"
                  onPress={submitReply}
                  size="sm"
                  loading={sending}
                  disabled={!reply.trim()}
                  fullWidth={false}
                />
              </View>
            </View>
          )}
        </View>
      )}
    </Card>
  );
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ForumScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const { user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);
  const [composing, setComposing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await apiService.getPosts();
      setPosts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(
        err?.message?.startsWith("Network")
          ? "We can't reach the community right now. Check your connection."
          : (err?.message ?? "We couldn't load the community.")
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePost = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      await apiService.createPost(draft.trim(), anonymous);
      setDraft("");
      setAnonymous(false);
      setComposing(false);
      toast.show("Posted to the community");
      await load("refresh");
    } catch (err: any) {
      toast.show(err?.message ?? "Couldn't post. Try again.", { tone: "error" });
    } finally {
      setPosting(false);
    }
  };

  /** Optimistic — the count moves immediately and rolls back if the call fails. */
  const handleLike = useCallback(
    async (id: string) => {
      if (likedIds.has(id)) return;
      setLikedIds((current) => new Set(current).add(id));
      setPosts((current) =>
        current.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p))
      );
      try {
        const response = await apiService.likePost(id);
        setPosts((current) =>
          current.map((p) => (p.id === id ? { ...p, likes: response.likes } : p))
        );
      } catch {
        setLikedIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        setPosts((current) =>
          current.map((p) => (p.id === id ? { ...p, likes: Math.max(0, p.likes - 1) } : p))
        );
        toast.show("Couldn't register that like", { tone: "error" });
      }
    },
    [likedIds, toast]
  );

  const handleComment = useCallback(
    async (postId: string, text: string, isAnonymous: boolean) => {
      try {
        await apiService.addComment(postId, text, isAnonymous);
        const comments = await apiService.getPostComments(postId);
        setPosts((current) =>
          current.map((p) => (p.id === postId ? { ...p, comments } : p))
        );
        toast.show("Reply added");
      } catch (err: any) {
        toast.show(err?.message ?? "Couldn't add your reply", { tone: "error" });
      }
    },
    [toast]
  );

  const toggleComments = useCallback(
    (id: string) => setExpandedId((current) => (current === id ? null : id)),
    []
  );

  /** Derived, not invented. Shown only once there is something to count. */
  const replyCount = useMemo(
    () => posts.reduce((total, p) => total + p.comments.length, 0),
    [posts]
  );

  const header = (
    <View>
      <ScreenHeader title="Community" showBack={false} />

      {posts.length > 0 && (
        <Text variant="callout" color="textSecondary" style={styles.summary}>
          {posts.length === 1 ? "1 post" : `${posts.length} posts`}
          {replyCount > 0 && ` · ${replyCount === 1 ? "1 reply" : `${replyCount} replies`}`}
        </Text>
      )}

      {user ? (
        composing ? (
          <Card style={styles.composer}>
            <Field
              label="Your post"
              placeholder="Ask a question, or share something that helped…"
              helper={`${draft.length} of ${MAX_POST_LENGTH} characters`}
              value={draft}
              onChangeText={(v) => setDraft(v.slice(0, MAX_POST_LENGTH))}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={styles.composerActions}>
              <Chip
                label="Post anonymously"
                selected={anonymous}
                onPress={() => setAnonymous((v) => !v)}
              />
              <View style={styles.composerButtons}>
                <Button
                  label="Cancel"
                  onPress={() => {
                    setComposing(false);
                    setDraft("");
                  }}
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                />
                <Button
                  label="Post"
                  onPress={handlePost}
                  size="sm"
                  loading={posting}
                  disabled={!draft.trim()}
                  fullWidth={false}
                />
              </View>
            </View>
          </Card>
        ) : (
          <Button
            label="Share something"
            onPress={() => setComposing(true)}
            icon="create-outline"
            style={styles.composeCta}
          />
        )
      ) : (
        <Card variant="sunken" style={styles.signedOut}>
          <Text variant="callout" color="textSecondary">
            Sign in to post and reply. You can read without an account.
          </Text>
        </Card>
      )}
    </View>
  );

  const empty = loading ? (
    <Card padded={false} style={styles.skeletonCard}>
      <SkeletonRows count={3} />
    </Card>
  ) : error ? (
    <EmptyState
      icon="cloud-offline-outline"
      title="Can't load the community"
      description={error}
      actionLabel="Try again"
      onActionPress={() => load()}
    />
  ) : (
    <EmptyState
      icon="chatbubbles-outline"
      title="No posts yet"
      description="This is a space to ask questions and share what's worked. Someone has to go first."
      actionLabel={user ? "Write the first post" : undefined}
      onActionPress={user ? () => setComposing(true) : undefined}
    />
  );

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            liked={likedIds.has(item.id)}
            expanded={expandedId === item.id}
            onToggleComments={toggleComments}
            onLike={handleLike}
            onComment={handleComment}
            canPost={Boolean(user)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // This screen manages its own scrolling, so it does not get the
        // handling `Screen` provides — and it has two text inputs, the
        // composer and the per-post reply box. Without these the reply field
        // sits directly under the keyboard, which is the worst case in the
        // app: the user cannot see what they are typing.
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load("refresh")}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },

  summary: { marginBottom: spacing.lg },
  composeCta: { marginBottom: spacing.xl },
  composer: { gap: spacing.lg, marginBottom: spacing.xl },
  composerActions: { gap: spacing.md },
  composerButtons: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  signedOut: { marginBottom: spacing.xl },
  skeletonCard: { paddingHorizontal: spacing.lg },

  post: { marginBottom: spacing.md, gap: spacing.md },
  postHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  author: { flex: 1 },
  postBody: { marginTop: -spacing.xs },
  postActions: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  comments: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  comment: { gap: 2, padding: spacing.md, borderRadius: radius.md },
  noComments: { paddingVertical: spacing.sm },
  replyBox: { gap: spacing.md, marginTop: spacing.sm },
  replyActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
});
