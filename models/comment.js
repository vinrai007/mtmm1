const mongoose = require('mongoose');
const {Schema,model} = mongoose;


// Define the Comment schema
const commentSchema = new mongoose.Schema({
  id: {
    type: Number, // or mongoose.Schema.Types.ObjectId for an automatically generated ID
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
    postId: {
    type: String, // Assuming postId is a Number, adjust as needed
    required: true,
  },
  authorId : String,
  author: String,
    // author:{type:Schema.Types.ObjectId, ref:'User'},
}, {
  timestamps: true,
});

commentSchema.statics.findBypostId = async function (postId) {
  return this.find({ postId: postId });
};

// Create the Comment model
const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
