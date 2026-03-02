const jwt = require("jsonwebtoken");

const getJwtSecret = () =>
  process.env.JWT_SECRET || "dev_jwt_secret_change_me_before_production";

const signToken = (payload) =>
  jwt.sign(payload, getJwtSecret(), {
    expiresIn: "7d",
  });

const verifyToken = (token) => jwt.verify(token, getJwtSecret());

module.exports = { signToken, verifyToken };
