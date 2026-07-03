const jwt = require("jsonwebtoken");

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "24h",
  });
};

const parseJSONSafely = (str) => {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
};

module.exports = { generateToken, parseJSONSafely };
