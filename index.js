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
const port = process.env.PORT || 4000; // Use the environment variable PORT if available, otherwise default to 4000




// const { auth } = require('express-openid-connect');
// const config = {
//   authRequired: false,
//   auth0Logout: true,
//   secret: 'a long, randomly-generated string stored in env',
//   baseURL: 'http://localhost:3000',
//   clientID: 'oablV5I5402kVVqDeCw6pXmay9ruk5Va',
//   issuerBaseURL: 'https://dev-u3howq02oodedw0j.us.auth0.com'
// };

// // auth router attaches /login, /logout, and /callback routes to the baseURL
// app.use(auth(config));

// // req.isAuthenticated is provided from the auth router
// app.get('/', (req, res) => {
//   res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
// });


app.use(cors({credentials:true,origin:`${front_url}`}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
// mongoose.connect('mongodb+srv://van:gan@cluster0.5te6pp7.mongodb.net/?retryWrites=true&w=majority');


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


app.post('/register', async (req,res) => {
  const {username,password} = req.body;
  try{
    const userDoc = await User.create({
      username,
      password:bcrypt.hashSync(password,salt),
    });
    res.json(userDoc);
  } catch(e) {
    console.log(e);
    res.status(400).json(e);
  }
});

app.post('/login', async (req,res) => {
  const {username,password} = req.body;
  const userDoc = await User.findOne({username});
  const passOk = bcrypt.compareSync(password, userDoc.password);
  if (passOk) {
    // logged in
    jwt.sign({username,id:userDoc._id}, secret, {}, (err,token) => {
      if (err) throw err;
      res.cookie('token', token).json({
        id:userDoc._id,
        username,
      });
    });
  } else {
    res.status(400).json('wrong credentials');
  }
});

app.get('/profile', (req,res) => {
  const {token} = req.cookies;
  jwt.verify(token, secret, {}, (err,info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post('/logout', (req,res) => {
  res.cookie('token', '').json('ok');
});

app.post('/post', uploadMiddleware.single('file'), async (req,res) => {
  const {originalname,path} = req.file;
  const parts = originalname.split('.');
  const ext = parts[parts.length - 1];
  const newPath = path+'.'+ext;
  fs.renameSync(path, newPath);

  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {title,summary,content} = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover:newPath,
      author:info.id,
    });
    res.json(postDoc);
  });

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

// app.get('/comment', async (req,res) => {
//   res.json(
//     await Comment.find()
//       .populate('author', ['username'])
//       .sort({createdAt: -1})
//       .limit(20)
//   );
// });

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


app.put('/post',uploadMiddleware.single('file'), async (req,res) => {
  let newPath = null;
  if (req.file) {
    const {originalname,path} = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = path+'.'+ext;
    fs.renameSync(path, newPath);
  }

  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {id,title,summary,content} = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json('you are not the author');
    }
    postDoc.title = title;
    postDoc.summary = summary;
    postDoc.content = content;
    if (newPath) {
      postDoc.cover = newPath;
    }
        await postDoc.save();

    // await postDoc.update({
    //   title,
    //   summary,
    //   content,
    //   cover: newPath ? newPath : postDoc.cover,
    // });

    res.json(postDoc);
  });

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

// app.get('/comment/:id', async (req, res) => {
//   const { id } = req.params;
//     res.json(
//     await Comment.findBypostId(id)
//       .populate('author', ['username'])
//       .sort({createdAt: -1})
//       .limit(20)
//   );
//   // const postDoc = await Post.findById(id).populate('author', ['username']);
//   // res.json(postDoc);
// })

app.listen(port);
//