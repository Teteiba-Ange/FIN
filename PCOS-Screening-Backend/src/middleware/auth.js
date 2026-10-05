const jwt = require("jsonwebtoken");
const { get } = require("../config/database");

/**
 * Verifies the access token *and* that the account it names still exists.
 *
 * The existence check is not incidental. Previously this only verified the
 * signature, so a token stayed usable for its full lifetime after the account
 * was deleted — and because every write is an upsert keyed on the user id, a
 * request made with such a token would happily insert new rows referencing a
 * user that no longer existed. Account deletion was therefore not durable:
 * a client that kept posting would resurrect data for a deleted account.
 *
 * The cost is one indexed primary-key lookup per authenticated request, which
 * is the ordinary price of being able to revoke access. It also means a
 * deleted or disabled account stops working immediately rather than whenever
 * its token happens to expire.
 */
const authMiddleware = async (req, res, next) => {
  const header = req.header("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (!decoded?.userId) {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const user = await get("SELECT id FROM users WHERE id = ?", [decoded.userId]);
    if (!user) {
      // Signature is valid but the account is gone. 401 rather than 404 — from
      // the client's point of view this session is simply no longer authorised,
      // and it should sign out rather than retry.
      return res.status(401).json({ error: "Account no longer exists" });
    }
  } catch (error) {
    // A database failure here must not be mistaken for a bad token, or every
    // client would sign the user out during a transient outage.
    console.error("[ERROR] authMiddleware lookup:", error);
    return res.status(503).json({ error: "Service temporarily unavailable" });
  }

  req.userId = decoded.userId;
  next();
};

module.exports = { authMiddleware };
