const express = require("express");
const mongoose = require("mongoose");

const Chat = require("../models/chat");
const User = require("../models/user");
const Message = require("../models/message");

const requireLogin = require("../middleware/requireLogin");

const router = express.Router();

router.post("/sendmessage", requireLogin, async (req, res) => {
  const { chatId, content } = req.body;

  if (!chatId || !content) {
    return res.status(422).json({ error: "Please add all the fields" });
  }

  const newMessage = new Message({
    sender: req.user._id,
    content: content,
    chat: chatId,
  });

  try {
    var message = await Message.create(newMessage);
    message = await message.populate("sender", "name profilePictureUrl");
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "name email profilePictureUrl",
    });
    await Chat.findByIdAndUpdate(req.body.chatId, {
      latestMessage: message,
    });
    res.json(message);
  } catch (err) {
    res.status(422).json({ error: err });
  }
});

router.get("/allmessages/:chatId", requireLogin, async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name profilePictureUrl email")
      .populate("chat");

    res.json(messages);
  } catch (err) {
    res.status(422).json({ error: err });
  }
});

module.exports = router;
