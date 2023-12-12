const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    songName: {
      type: String,
      required: true,
    },
    artistName: {
      type: String,
      required: true,
    },
    albumName: {
      type: String,
      required: true,
    },
    albumCoverUrl: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      required: true,
    },
    fundraiser: {
      type: Boolean,
      default: false,
    },
    spotifyUrl: {
      type: String,
      required: true,
      default: "https://open.spotify.com",
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: [
      {
        text: String,
        postedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isPublic:{
      type:Boolean,
      default:false
    }
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Post", postSchema);
