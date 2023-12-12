const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const fetch = require("node-fetch");
const spotifyWebApi = require("spotify-web-api-node");

const Post = require("../models/post");

const requireLogin = require("../middleware/requireLogin");

router.post("/createpost", requireLogin, (req, res) => {
  const { spotifyLink, caption } = req.body;
  if (!spotifyLink) {
    return res.status(422).json({ error: "Please add the Spotify Link" });
  }
  if (!caption) {
    return res.status(422).json({ error: "Please add the Caption" });
  }
  console.log(spotifyLink);
  req.user.password = undefined;
  req.user.securityQuestion = undefined;
  req.user.securityAnswer = undefined;
  console.log(req.user)
  const spotifyId = spotifyLink.substring(
    spotifyLink.lastIndexOf("/") + 1,
    spotifyLink.lastIndexOf("?")
  );

  

  const spotifyApi = new spotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });

  spotifyApi.clientCredentialsGrant().then(
    function (data) {
      spotifyApi.setAccessToken(data.body["access_token"]);

      spotifyApi
        .getTrack(spotifyId)
        .then((data) => {
          //code to concate the artists name in a string
          let artists = "";
          for (let i = 0; i < data?.body?.artists?.length; i++) {
            artists += data?.body?.artists[i]?.name;
            if (i != data?.body?.artists?.length - 1) {
              artists += ", ";
            }
          }
          const post = new Post({
            songName: data?.body?.name,
            artistName: artists,
            albumName: data?.body?.album?.name,
            albumCoverUrl: data?.body?.album?.images[0]?.url,
            caption: caption,
            spotifyUrl: spotifyLink,
            postedBy: req.user,
            isPublic:req.user.isPublic
          });
          post
            .save()
            .then((result) => {
              res.json({ post: result });
            })
            .catch((err) => {
              console.log(err);
            });
        })
        .catch((err) => {
          console.log(err);
        });
    },
    function (err) {
      console.log("Something went wrong!", err);
    }
  );
});

router.get("/followposts", requireLogin, (req, res) => {
  users = req.user.following;
  users.push(req.user._id);
  Post.find({ $or:[{postedBy:users},{isPublic:true}] })
    .sort({ createdAt: -1 })
    .populate("postedBy", "_id name profilePictureUrl")
    .populate("comments.postedBy", "_id name")
    .then((posts) => {
      res.json({ posts });
    })
    .catch((err) => {
      console.log(err);
    });
});

router.get("/allposts", 

// requireLogin,
 (req, res) => {
  Post.find()
    .sort({ createdAt: -1 })
    .populate("postedBy", "_id name profilePictureUrl")
    .populate("comments.postedBy", "_id name")
    .then((posts) => {
      res.json({ posts });
    })
    .catch((err) => {
      console.log(err);
    });
});

router.get("/deletepost/:id", requireLogin, (req, res) => {
  console.log("entering");
  Post.deleteOne({ _id: req.params.id }).then((result) => {
    res.json("");
  });
  console.log("enteringqwdwq");
});

router.get("/myposts", requireLogin, (req, res) => {
  Post.find({ postedBy: req.user._id })
    .sort({ createdAt: -1 })
    .populate("postedBy", "_id name")
    .then((myposts) => {
      res.json({ myposts });
    })
    .catch((err) => {
      console.log(err);
    });
});

router.put("/like", requireLogin, (req, res) => {
  Post.findByIdAndUpdate(
    req.body.postId,
    {
      $push: { likes: req.user._id },
    },
    {
      new: true,
    }
  )
    .populate("comments.postedBy", "_id name")
    .populate("postedBy", "_id name")
    .then((result) => {
      res.json(result);
    })
    .catch((err) => {
      return res.status(422).json({ error: err });
    });
});

router.put("/unlike", requireLogin, (req, res) => {
  Post.findByIdAndUpdate(
    req.body.postId,
    {
      $pull: { likes: req.user._id },
    },
    {
      new: true,
    }
  )
    .populate("comments.postedBy", "_id name")
    .populate("postedBy", "_id name")
    .then((result) => {
      res.json(result);
    })
    .catch((err) => {
      return res.status(422).json({ error: err });
    });
});

router.put("/comment", requireLogin, (req, res) => {
  const comment = {
    text: req.body.text,
    postedBy: req.user._id,
  };
  Post.findByIdAndUpdate(
    req.body.postId,
    {
      $push: { comments: comment },
    },
    {
      new: true,
    }
  )
    .populate("comments.postedBy", "_id name")
    .populate("postedBy", "_id name")
    .then((result) => {
      res.json(result);
    })
    .catch((err) => {
      return res.status(422).json({ error: err });
    });
});

module.exports = router;
