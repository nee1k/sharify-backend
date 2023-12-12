const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");
const crypto = require("crypto");

const router = express.Router();

const User = require("../models/user");

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: process.env.SENDGRID_API_KEY,
    },
  })
);

router.post("/signup", (req, res) => {
  const { name, email, password, securityQuestion, securityAnswer, location, accountType } = req.body;

  if (!name || !email || !password || !securityQuestion || !securityAnswer) {
    return res.status(422).json({ error: "Please add all the fields" });
  }
  let isPublic = accountType=="public"?true:false

  User.findOne({ email: email })
    .then((savedUser) => {
      if (savedUser) {
        return res.status(422).json({ error: "User already exists" });
      }
      bcrypt.hash(password, 12).then((hashedPassword) => {
        bcrypt.hash(securityAnswer, 12).then((hashedSecurityAnswer) => {
          const user = new User({
            name,
            email,
            password: hashedPassword,
            securityQuestion,
            securityAnswer: hashedSecurityAnswer,
            location:location,
            isPublic:isPublic
          });
          user
            .save()
            .then((user) => {
              transporter.sendMail({
                to: user.email,
                from: "ntelkar@iu.edu",
                subject: "Signup success",
                html: "<h1>Welcome to Sharify</h1>",
              });
              res.json({
                message: "New user created successfully",
                // user: {
                //   _id,
                //   name,
                //   email,
                //   profilePictureUrl,
                //   followers,
                //   following,
                //   hideEmail,
                // },
              });
            })
            .catch((err) => {
              console.log(err);
            });
        });
      });
    })
    .catch((err) => {
      console.log(err);
    });
});

router.post("/signin", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(422).json({ error: "Please add email or password" });
  }

  User.findOne({ email: email }).then((savedUser) => {
    if (!savedUser) {
      return res.status(422).json({ error: "Invalid email or password" });
    }
    bcrypt
      .compare(password, savedUser.password)
      .then((match) => {
        if (match) {
          const token = jwt.sign(
            { _id: savedUser._id },
            process.env.JWT_SECRET
          );
          var {
            _id,
            name,
            email,
            profilePictureUrl,
            following,
            followers,
            hideEmail,
          } = savedUser;

          hideEmail = hideEmail.toString();
          return res.json({
            token,
            //user: { _id, name, email },
            user: {
              _id,
              name,
              email,
              profilePictureUrl,
              following,
              followers,
              hideEmail,
            },
          });
        } else {
          return res.status(422).json({ error: "Invalid email or password" });
        }
      })
      .catch((err) => {
        console.log(err);
      });
  });
});

router.post("/security-question", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(422).json({ error: "Please add email" });
  }

  User.findOne({ email: email }).then((savedUser) => {
    if (!savedUser) {
      return res.status(422).json({ error: "User does not exist" });
    }
    return res.json({ securityQuestion: savedUser.securityQuestion });
  });
});

router.post("/reset-password-question", (req, res) => {
  const { email, securityAnswer } = req.body;

  if (!email || !securityAnswer) {
    return res.status(422).json({ error: "Please add all the fields" });
  }

  User.findOne({ email: email }).then((savedUser) => {
    if (!savedUser) {
      return res.status(422).json({ error: "User does not exist" });
    }
    bcrypt
      .compare(securityAnswer, savedUser.securityAnswer)
      .then((match) => {
        if (match) {
          crypto.randomBytes(32, (err, buffer) => {
            if (err) {
              console.log(err);
              return res.status(422).json({
                error: "Something went wrong, please try again later",
              });
            }
            const token = buffer.toString("hex");
            savedUser.resetToken = token;
            savedUser.expireToken = Date.now() + 3600000;
            savedUser.save().then((result) => {
              res.json({ resetToken: token });
            });
          });
        } else {
          return res.status(422).json({ error: "Invalid answer" });
        }
      })
      .catch((err) => {
        console.log(err);
      });
  });
});

router.post("/reset-password", (req, res) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
      return res
        .status(422)
        .json({ error: "Something went wrong, please try again later" });
    }
    const token = buffer.toString("hex");
    User.findOne({ email: req.body.email }).then((user) => {
      if (!user) {
        return res
          .status(422)
          .json({ error: "User does not exist with that email" });
      }
      user.resetToken = token;
      user.expireToken = Date.now() + 3600000;
      user.save().then((result) => {
        transporter.sendMail({
          to: user.email,
          from: "ntelkar@iu.edu",
          subject: "Password Reset",
          html: `
            <p>You requested for password reset</p>
            <h5>Click on this <a href="${process.env.CLIENT_URL}/newpassword/${token}">link</a> to reset password</h5>
          `,
        });
        res.json({ message: "Please check your email" });
      });
    });
  });
});

router.post("/new-password", (req, res) => {
  const newPassword = req.body.newPassword;
  const sentToken = req.body.resetToken;
  User.findOne({
    resetToken: sentToken,
    expireToken: { $gt: Date.now() },
  })
    .then((user) => {
      if (!user) {
        return res
          .status(422)
          .json({ error: "Session expired, please try again!" });
      }
      bcrypt.hash(newPassword, 12).then((hashedPassword) => {
        user.password = hashedPassword;
        user.resetToken = undefined;
        user.expireToken = undefined;
        user.save().then((savedUser) => {
          res.json({ message: "Password updated successfully" });
        });
      });
    })
    .catch((err) => {
      console.log(err);
    });
});

module.exports = router;
