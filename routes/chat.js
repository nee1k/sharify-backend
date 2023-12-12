const express = require("express");
const mongoose = require("mongoose");

const Chat = require("../models/chat");
const User = require("../models/user");

const requireLogin = require("../middleware/requireLogin");

const router = express.Router();

router.post("/accesschat", requireLogin, async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(422).json({ error: "Please add userId" });
  }

  var isChat = await Chat.find({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } },
      { users: { $elemMatch: { $eq: userId } } },
    ],
  })
    .populate(
      "users",
      "-password -resetToken -expireToken -securityQuestion -securityAnswer"
    )
    .populate("latestMessage");

  isChat = await User.populate(isChat, {
    path: "latestMessage.sender",
    select:
      "-password -securityQuestion -securityAnswer -resetToken -expireToken",
  });

  if (isChat.length > 0) {
    return res.json({ chat: isChat[0] });
  } else {
    const newChat = new Chat({
      chatName: "sender",
      isGroupChat: false,
      users: [req.user._id, userId],
    });

    try {
      const createdChat = await Chat.create(newChat);

      const fullChat = await Chat.findOne({ _id: createdChat._id }).populate(
        "users",
        "-password -resetToken -expireToken -securityQuestion -securityAnswer"
      );

      res.json({ chat: fullChat });
    } catch (err) {
      res.status(422).json({ error: err });
    }
  }
});

router.get("/getchat", requireLogin, (req, res) => {
  try {
    Chat.find({
      users: { $elemMatch: { $eq: req.user._id } },
    })
      .populate(
        "users",
        "-password -resetToken -expireToken -securityQuestion -securityAnswer"
      )
      .populate(
        "groupAdmin",
        "-password -resetToken -expireToken -securityQuestion -securityAnswer"
      )
      .populate("latestMessage")
      .sort({ updatedAt: -1 })
      .then(async (results) => {
        results = await User.populate(results, {
          path: "latestMessage.sender",
          select:
            "-password -securityQuestion -securityAnswer -resetToken -expireToken",
        });
        res.json({ chats: results });
      });
  } catch (err) {
    res.status(422).json({ error: err });
  }
});

router.post("/creategroup", requireLogin, async (req, res) => {
  if (!req.body.groupName || !req.body.users) {
    return res.status(422).json({ error: "Please add group name" });
  }

  var users = JSON.parse(req.body.users);
  if (users.length < 2) {
    return res.status(422).json({ error: "Please add atleast two users" });
  }

  users.push(req.user);

  try {
    const groupChat = await Chat.create({
      chatName: req.body.groupName,
      users: users,
      isGroupChat: true,
      groupAdmin: req.user,
    });
    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate(
        "users",
        "-password -resetToken -expireToken -securityQuestion -securityAnswer"
      )
      .populate(
        "groupAdmin",
        "-password -resetToken -expireToken -securityQuestion -securityAnswer"
      );

    res.json({ chat: fullGroupChat });
  } catch (err) {
    res.status(422).json({ error: err });
  }
});

router.put("/groupadd", requireLogin, async (req, res) => {
  const { chatId, userId } = req.body;

  const added = await Chat.findByIdAndUpdate(
    chatId,
    {
      $push: { users: userId },
    },
    {
      new: true,
    }
  )
    .populate(
      "users",
      "-password -resetToken -expireToken -securityQuestion -securityAnswer"
    )
    .populate(
      "groupAdmin",
      "-password -resetToken -expireToken -securityQuestion -securityAnswer"
    );

  if (!added) {
    return res.status(422).json({ error: "User not added" });
  } else {
    res.json({ chat: added });
  }
});

router.put("/groupremove", requireLogin, async (req, res) => {
  const { chatId, userId } = req.body;

  const removed = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull: { users: userId },
    },
    {
      new: true,
    }
  )
    .populate(
      "users",
      "-password -resetToken -expireToken -securityQuestion -securityAnswer"
    )
    .populate(
      "groupAdmin",
      "-password -resetToken -expireToken -securityQuestion -securityAnswer"
    );

  if (!removed) {
    return res.status(422).json({ error: "User not added" });
  } else {
    res.json({ chat: removed });
  }
});

module.exports = router;
