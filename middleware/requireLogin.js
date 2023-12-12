const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const User = require("../models/user");

const requireLogin = (req, res, next) => {
  const { authorization } = req.headers;
  if (!authorization) {
    return res.status(401).json({ error: "You must Sign In first" });
  }
  const token = authorization.replace("Bearer ", "");
  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(401).json({ error: "You must Sign In first" });
    }

    const { _id } = payload;
    User.findById(_id).then((userData) => {
      if (!userData) {
        return res.status(401).json({ error: "You must Sign In first" });
      }
      req.user = userData;
      next();
    });
  });
};

module.exports = requireLogin;
