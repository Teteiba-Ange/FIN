const { v4: uuidv4 } = require("uuid");
const { run, all, get } = require("../config/database");

const createPost = async (req, res) => {
  try {
    const { content, anonymous } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Post content is required" });
    }

    const postId = uuidv4();
    const user = await get("SELECT fullName FROM users WHERE id = ?", [req.userId]);

    await run(
      "INSERT INTO posts (id, userId, username, content, anonymous) VALUES (?, ?, ?, ?, ?)",
      [
        postId,
        req.userId,
        anonymous ? "Anonymous" : user.fullName,
        content.trim(),
        anonymous ? 1 : 0,
      ]
    );

    res.status(201).json({
      message: "Post created successfully",
      postId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getPosts = async (req, res) => {
  try {
    const posts = await all(
      "SELECT * FROM posts ORDER BY createdAt DESC LIMIT 50"
    );

    const postsWithComments = await Promise.all(
      posts.map(async (post) => {
        const comments = await all(
          "SELECT id, userId, username, text, anonymous, createdAt FROM comments WHERE postId = ? ORDER BY createdAt",
          [post.id]
        );
        return {
          ...post,
          comments: comments.map(c => ({
            ...c,
            anonymous: !!c.anonymous,
          })),
        };
      })
    );

    res.json(postsWithComments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const likePost = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await get("SELECT * FROM posts WHERE id = ?", [postId]);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    await run("UPDATE posts SET likes = likes + 1 WHERE id = ?", [postId]);

    res.json({ message: "Post liked successfully", likes: post.likes + 1 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text, anonymous } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const post = await get("SELECT * FROM posts WHERE id = ?", [postId]);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const commentId = uuidv4();
    const user = await get("SELECT fullName FROM users WHERE id = ?", [req.userId]);

    await run(
      "INSERT INTO comments (id, postId, userId, username, text, anonymous) VALUES (?, ?, ?, ?, ?, ?)",
      [
        commentId,
        postId,
        req.userId,
        anonymous ? "Anonymous" : user.fullName,
        text.trim(),
        anonymous ? 1 : 0,
      ]
    );

    res.status(201).json({
      message: "Comment added successfully",
      commentId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;

    const comments = await all(
      "SELECT id, userId, username, text, anonymous, createdAt FROM comments WHERE postId = ? ORDER BY createdAt",
      [postId]
    );

    res.json(comments.map(c => ({
      ...c,
      anonymous: !!c.anonymous,
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await get("SELECT * FROM posts WHERE id = ?", [postId]);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.userid !== req.userId) {
      return res.status(403).json({ error: "Permission denied" });
    }

    await run("DELETE FROM comments WHERE postId = ?", [postId]);
    await run("DELETE FROM posts WHERE id = ?", [postId]);

    res.json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const comment = await get("SELECT * FROM comments WHERE id = ? AND postId = ?", [commentId, postId]);

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (comment.userid !== req.userId) {
      return res.status(403).json({ error: "Permission denied" });
    }

    await run("DELETE FROM comments WHERE id = ?", [commentId]);

    res.json({ success: true, message: "Comment deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createPost,
  getPosts,
  likePost,
  addComment,
  getPostComments,
  deletePost,
  deleteComment,
};
