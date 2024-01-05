const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const User = require('./models/User');
const Post = require('./models/Post');
const Comment = require('./models/comment'); // Import your Comment model
const bcrypt = require('bcryptjs');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs');
const uri = 'mongodb+srv://van:gan@cluster0.5te6pp7.mongodb.net/?retryWrites=true&w=majority';
const salt = bcrypt.genSaltSync(10);
const secret = 'asdfe45we45w345wegw345werjktjwertkj';
const front_url = `http://localhost:3000`;
// const front_url = `https://lustrous-bubblegum-923c1e.netlify.app`;
const port = process.env.PORT || 4000; // Use the environment variable PORT if available, otherwise default to 4000

app.use(cors({credentials:true,origin:`${front_url}`}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
// mongoose.connect('mongodb+srv://van:gan@cluster0.5te6pp7.mongodb.net/?retryWrites=true&w=majority');

async function handleAuthenticationErrors(err, req, res, next) {
  try {
    if (err.name === 'UnauthorizedError') {
      res.status(401).json({ error: 'Unauthorized: Invalid username or password' });
    } else {
      next(err);
    }
  } catch (error) {
    console.error('Error in handleAuthenticationErrors:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

app.use(handleAuthenticationErrors);

const likeSchema = new mongoose.Schema({
    postId: String,
    userId: String,
    isLiked: Boolean,
});



const Like = mongoose.model('Like', likeSchema);

// Handle POST request for liking a post
app.post('/api/like', async (req, res) => {
    const { postId, userId, isLiked } = req.body;

    // Update or create a like record in the database
    await Like.findOneAndUpdate(
        { postId, userId },
        { postId, userId, isLiked },
        { upsert: true, new: true }
    );

    // Calculate the total number of likes for the post
    const likesCount = await Like.countDocuments({ postId, isLiked: true });

    res.json({ isLiked, likesCount });
});

// Handle GET request to check initial like status and count
app.get('/api/like', async (req, res) => {
    const { postId, userId } = req.query;

    // Find the like record for the given post and user
    const like = await Like.findOne({ postId, userId });

    // Calculate the total number of likes for the post
    const likesCount = await Like.countDocuments({ postId, isLiked: true });

    res.json({ isLiked: !!like, likesCount });
});

app.post('/register', async (req, res) => {
  const { username, password, writer } = req.body;

  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
      writer:0,
    });
    res.json(userDoc);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern && error.keyPattern.username === 1) {
      // Duplicate username error
      return res.status(400).json({ error: 'Username is already taken' });
    }

    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Add this to your backend code
app.post('/join-as-writer', (req, res) => {
  const { token } = req.cookies;
  
  jwt.verify(token, secret, {}, async (err, decodedToken) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: userId } = decodedToken;

    try {
      // Assuming you have a User model
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update the user's writer status
      user.writer = 1;
      await user.save();

      res.status(200).json({ message: 'Successfully joined as a writer' });
    } catch (error) {
      console.error('Error joining as a writer:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
});


app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const userDoc = await User.findOne({ username });

    if (!userDoc) {
      return res.status(400).json({ error: 'User not found' });
    }

    const passOk = bcrypt.compareSync(password, userDoc.password);

    if (passOk) {
      // Include 'writer' in the payload
      const payload = { username, id: userDoc._id, writer: userDoc.writer };

      // logged in
      jwt.sign(payload, secret, {}, (err, token) => {
        if (err) throw err;
        res.cookie('token', token).json({
          id: userDoc._id,
          username,
          writer: userDoc.writer, // Include 'writer' in the response
        });
      });
    } else {
      res.status(400).json({ error: 'Wrong credentials' });
    }
  } catch (error) {
    console.error('An error occurred during login:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// app.get('/profile', (req, res) => {
//   const { token } = req.cookies;

//   jwt.verify(token, secret, {}, (err, info) => {
//     if (err) {
//       if (err.name === 'TokenExpiredError') {
//         // Handle expired token, possibly ask the user to log in again
//         return res.status(401).json({ error: 'Token has expired' });
//       } else {
//         // Other token verification errors
//         return res.status(401).json({ error: 'Unauthorized' });
//       }
//     }

//     const userProfile = {
//       username: info.username,
//       id: info._id,
//       writer: info.writer,
//     };

//     res.json(userProfile);
//   });
// });

app.get('/profile', async (req, res) => {
  const { token } = req.cookies;

  try {
    // Verify the token and get user information
    const decodedToken = jwt.verify(token, secret);

    // Find the user document using the decoded user ID
    const userDoc = await User.findById(decodedToken.id);

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userProfile = {
      username: userDoc.username,
      id: userDoc._id,
      writer: userDoc.writer,
    };

    res.json(userProfile);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    } else {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
});



app.post('/logout', (req,res) => {
  res.cookie('token', '').json('ok');
});

// app.post('/post', uploadMiddleware.single('file'), async (req,res) => {
//   const {originalname,path} = req.file;
//   const parts = originalname.split('.');
//   const ext = parts[parts.length - 1];
//   const newPath = path+'.'+ext;
//   fs.renameSync(path, newPath);

//   const {token} = req.cookies;
//   jwt.verify(token, secret, {}, async (err,info) => {
//     if (err) throw err;
//     const {title,summary,content} = req.body;
//     const postDoc = await Post.create({
//       title,
//       summary,
//       content,
//       cover:newPath,
//       author:info.id,
//     });
//     res.json(postDoc);
//   });
// });

app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split('.');
  const ext = parts[parts.length - 1];
  const newPath = path + '.' + ext;
  fs.renameSync(path, newPath);

  // Temporarily removing jwt.verify for demonstration purposes
  // const { token } = req.cookies;
  // jwt.verify(token, secret, {}, async (err, info) => {
  //   if (err) throw err;
  
  try {
    const { title, summary, content, userId, username} = req.body;
    // const {userId } = req;
    // Temporarily hardcoding author ID, replace this with actual user authentication
    // const authorId = 'some_user_id';

    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: newPath,
      authorId: userId,
      author: username,
    });

    res.json(postDoc);
  } catch (error) {
    console.error('An error occurred during post creation:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
  // });
});


// for comment
app.post('/comments', async (req, res) => {
  const { text, postId } = req.body;
  // res.cookie('token', '').json('ok');
    const {token} = req.cookies;
    jwt.verify(token, secret, {}, async (err,info) => {

  try {
      // const {token} = req.cookies;
  // jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    if (text.trim() !== "") {
      const newComment = await Comment.create({
        id: Date.now(),
        text: text,
        postId: postId, // Associate the comment with a specific post
        author:info.id,
      });

      res.json(newComment);
    } else {
      res.status(400).json({ error: 'Comment text cannot be empty.' });
    }
   } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
   }
  });
});

module.exports = app;

app.get('/comment', async (req, res) => {
  const { postId } = req.query;

  try {
    let commentsQuery = Comment.find().populate('author', ['username']).sort({ createdAt: -1 }).limit(20);

    if (postId) {
      // If postId is provided, filter comments based on postId
      commentsQuery = commentsQuery.where('postId').equals(postId);
    }

    const comments = await commentsQuery.exec();
    res.json(comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// app.put('/post',uploadMiddleware.single('file'), async (req,res) => {
//   let newPath = null;
//   if (req.file) {
//     const {originalname,path} = req.file;
//     const parts = originalname.split('.');
//     const ext = parts[parts.length - 1];
//     newPath = path+'.'+ext;
//     fs.renameSync(path, newPath);
//   }

//   const {token} = req.cookies;
//   jwt.verify(token, secret, {}, async (err,info) => {
//     if (err) throw err;
//     const {id,title,summary,content} = req.body;
//     const postDoc = await Post.findById(id);
//     const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
//     if (!isAuthor) {
//       return res.status(400).json('you are not the author');
//     }
//     postDoc.title = title;
//     postDoc.summary = summary;
//     postDoc.content = content;
//     if (newPath) {
//       postDoc.cover = newPath;
//     }
//         await postDoc.save();

//     res.json(postDoc);
//   });
// });


app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
  let newPath = null;

  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = path + '.' + ext;
    fs.renameSync(path, newPath);
  }

  // Temporarily removing jwt.verify for demonstration purposes
  // const { token } = req.cookies;
  // jwt.verify(token, secret, {}, async (err, info) => {
  //   if (err) throw err;

  try {
    const { id, title, summary, content } = req.body;
    
    // Temporarily hardcoding author ID, replace this with actual user authentication
    const authorId = 'some_user_id';

    const postDoc = await Post.findById(id);

    // Temporarily removing author verification for demonstration purposes
    // const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    // if (!isAuthor) {
    //   return res.status(400).json('you are not the author');
    // }

    postDoc.title = title;
    postDoc.summary = summary;
    postDoc.content = content;

    if (newPath) {
      postDoc.cover = newPath;
    }

    await postDoc.save();

    res.json(postDoc);
  } catch (error) {
    console.error('An error occurred during post update:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
  // });
});


app.get('/post', async (req,res) => {
  res.json(
    await Post.find()
      .populate('author', ['username'])
      .sort({createdAt: -1})
      .limit(20)
  );
});

app.get('/post/:id', async (req, res) => {
  const {id} = req.params;
  const postDoc = await Post.findById(id).populate('author', ['username']);
  res.json(postDoc);
})

app.listen(port);
//