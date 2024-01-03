const mongoose = require('mongoose');
const {Schema, model} = mongoose;

const UserSchema = new Schema({
  username: {type: String, required: true, min: 4, unique: true},
  password: { type: String, required: true },
  writer: { type: Number, required: true}, // 0 means not a writer, 1 means a writer
});

const UserModel = model('User', UserSchema);

module.exports = UserModel;