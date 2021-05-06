// schema file for new documents added via mongoose. Authentication & hash password.

const mongoose = require('mongoose');
const uuidv4 = require('uuid/v4');

const s3Cred = require('../routes/api/s3credentials.js');

// Basic user schema
// Schema is an object that defines the structure of any documents that will be stored in your MongoDB collection; it enables you to define types and validators for all of your data items.
const UserSchema = new mongoose.Schema({
    _id: { 
        type: String, 
        default: uuidv4(),
        required: true
    },
    active: {
        type: Boolean,
        default: false,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true,
        trim: true
    },
    username: {
        type: String,
        unique: true,
        required: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true
    },
    friends: {
        type: Array,
        required: true,
    },
    videos: {
        type: Array,
        required: true,
    },
    avatarurl: {
        type: String,
        required: false,
    },
    advertiser: {
        type: String,
        required: false
    },
    chats: {
        type: Array,
        required: true,
    },
    articles: {
        type: Array,
        required: true
    },
    payment: {
        type: String,
        required: true
    },
    shipping: {
        type: Object,
        required: true
    }
});

// Mongoose automatically looks for a plural version of the model name defined below 'User'. So User automatically looks for "users" in the database and if that does not exist it makes a collection named 'users' and begins adding to it everytime the User.create function is ran. Pass the data in as a variable containing the value pairs. The next argument can be a function, e.g User.crate(Userdata, function(error, user) { console.log(user)})

// Model is an object that gives you easy access to a named collection, allowing you to query the collection and use the Schema to validate any documents you save to that collection. It is created by combining a Schema, a Connection, and a collection name.

var User = mongoose.model('User', UserSchema);
module.exports = User;
