const express = require("express");
const {
  createPost,
  getPosts,
  likePost,
  addComment,
  getPostComments,
  deletePost,
  deleteComment,
} = require("../controllers/postController");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.post("/", authMiddleware, createPost);
router.get("/", getPosts);
router.post("/:postId/like", likePost);
router.post("/:postId/comments", authMiddleware, addComment);
router.get("/:postId/comments", getPostComments);
router.delete("/:postId", authMiddleware, deletePost);
router.delete("/:postId/comments/:commentId", authMiddleware, deleteComment);

module.exports = router;
