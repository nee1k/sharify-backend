const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/user");
const Post = require("../models/post");

const requireLogin = require("../middleware/requireLogin");

const router = express.Router();

router.get("/get-user", requireLogin, (req, res) => {
  User.findById(req.user._id)
    .select("-resetToken -expireToken")
    .then((user) => {
      return res.json({ user });
    })
    .catch((err) => {
      return res.status(422).json({ error: err });
    });
});

router.post("/edit-profile", requireLogin, (req, res) => {
  const { name, email, password, profilePictureUrl, hideEmail } = req.body;
  User.findById(req.user._id)
    .then((savedUser) => {
      if (!savedUser) {
        return res.status(422).json({ error: "User does not exist" });
      }
      if (name) savedUser.name = name;
      if (email) savedUser.email = email;
      if (profilePictureUrl) savedUser.profilePictureUrl = profilePictureUrl;
      if (hideEmail) savedUser.hideEmail = hideEmail === "true";
      if (password) {
        bcrypt.hash(password, 12).then((hashedPassword) => {
          savedUser.password = hashedPassword;
        });
      }
      savedUser.save().then((user) => {
        var {
          _id,
          name,
          email,
          profilePictureUrl,
          following,
          followers,
          hideEmail,
        } = user;

        hideEmail = hideEmail.toString();

        return res.json({
          message: "Profile updated successfully",
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
      });
    })
    .catch((err) => {
      return res.status(422).json({ error: err });
    });
});

router.get("/user/:id", requireLogin, (req, res) => {
  User.findOne({ _id: req.params.id })
    .select("-password")
    .then((user) => {
      Post.find({ postedBy: req.params.id })
        .populate("postedBy", "_id name")
        .then((posts) => {
          res.json({ user, posts });
        })
        .catch((err) => {
          res.status(422).json({ error: err });
        });
    })
    .catch((err) => {
      return res.status(404).json({ error: "User not found" });
    });
});

router.post("/search-users", (req, res) => {
  const userPattern = new RegExp(req.body.query, "i"); // 'i' for case-insensitive
  User.find({ email: { $regex: userPattern } })
    .select("_id email name") // Include any other fields you want
    .then((users) => {
      res.json({ users });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: "Internal Server Error" });
    });
});

router.post("/search-users-by-name", (req, res) => {
  const userPattern = new RegExp(req.body.query, "i"); // 'i' for case-insensitive
  User.find({ name: { $regex: userPattern } })
    .select("_id name") // Include any other fields you want
    .then((users) => {
      res.json({ users });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: "Internal Server Error" });
    });
});

router.post("/search-users-by-location", (req, res) => {
  const locationPattern = new RegExp(req.body.query, "i");
  User.find({ location: { $regex: locationPattern } })
    .select("_id name")
    .then((users) => {
      res.json({ users });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: "Internal Server Error" });
    });
});

router.put("/follow", requireLogin, (req, res) => {
  User.findByIdAndUpdate(
    req.body.followId,
    {
      $push: { followers: req.user._id },
    },
    {
      new: true,
    }
  ).then((result) => {
    User.findByIdAndUpdate(
      req.user._id,
      {
        $push: { following: req.body.followId },
      },
      {
        new: true,
      }
    )
      .select("-password")
      .then((result) => {
        res.json(result);
      })
      .catch((err) => {
        return res.status(422).json({ error: err });
      });
  });
});

router.put("/unfollow", requireLogin, (req, res) => {
  User.findByIdAndUpdate(
    req.body.followId,
    {
      $pull: { followers: req.user._id },
    },
    {
      new: true,
    }
  ).then((result) => {
    User.findByIdAndUpdate(
      req.user._id,
      {
        $pull: { following: req.body.followId },
      },
      {
        new: true,
      }
    )
      .select(
        "-password -resetToken -expireToken -securityQuestion -securityAnswer"
      )
      .then((result) => {
        res.json(result);
      })
      .catch((err) => {
        return res.status(422).json({ error: err });
      });
  });
});

router.get("/recommended-users", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const following = user.following;
    const followers = user.followers;

    const userFollowers = await User.find({
      _id: { $in: following },
    }).select(
      "-password -resetToken -expireToken -securityQuestion -securityAnswer -followers -email -createdAt -updatedAt -__v"
    );

    const followingOfFollowing = [];
    userFollowers.forEach((user) => {
      followingOfFollowing.push(...user.following);
    });

    const recommendedFollowers = [];
    followingOfFollowing.forEach((id) => {
      if (!following.includes(id) && !id.equals(req.user._id)) {
        recommendedFollowers.push(id);
      }
    });

    var recommendedUsers;
    function pickRandomItems(arr, n) {
      const shuffled = arr.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, n);
    }

    if (recommendedFollowers.length != 0) {
      recommendedUsers = await User.find({
        _id: { $in: recommendedFollowers, $ne: req.user._id },
      }).select(
        "-password -resetToken -expireToken -securityQuestion -securityAnswer -followers -following -email -createdAt -updatedAt -__v"
      );
    } else {
      recommendedUsers = await User.find({
        _id: { $nin: following, $ne: req.user._id },
      }).select(
        "-password -resetToken -expireToken -securityQuestion -securityAnswer -followers -following -email -createdAt -updatedAt -__v"
      );
    }

    recommendedUsers = pickRandomItems(recommendedUsers, 3);
    res.json({ users: recommendedUsers });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/search", requireLogin, (req, res) => {
  const keyword = req.query.search
    ? {
        $or: [
          { name: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
        ],
      }
    : {};

  User.find({ ...keyword })
    .find({ _id: { $ne: req.user._id } })
    .select(
      "-password -resetToken -expireToken -securityQuestion -securityAnswer -createdAt -updatedAt -__v"
    )
    .then((users) => {
      res.json({ users });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: "Internal Server Error" });
    });
});

module.exports = router;
