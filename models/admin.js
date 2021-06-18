// schema file for new documents added via mongoose. Authentication & hash password.

const mongoose = require('mongoose');
const uuidv4 = require('uuid/v4');

const s3Cred = require('../routes/api/s3credentials.js');

// Admin schema
// id: Unique id for admin
// ref: Reference to user id
// auth: Level of authorization for administration privileges

// Types of priv: full (access to delete and create shops)
const AdminSchema = new mongoose.Schema({
    _id: { 
        type: String, 
        default: uuidv4(),
        required: true
    },
    ref: {
        type: String,
        required: true
    },
    auth: {
        type: String,
        required: false
    }
});

// Mongoose automatically looks for a plural version of the model name defined below 'User'. So User automatically looks for "users" in the database and if that does not exist it makes a collection named 'users' and begins adding to it everytime the User.create function is ran. Pass the data in as a variable containing the value pairs. The next argument can be a function, e.g User.crate(Userdata, function(error, user) { console.log(user)})

// Model is an object that gives you easy access to a named collection, allowing you to query the collection and use the Schema to validate any documents you save to that collection. It is created by combining a Schema, a Connection, and a collection name.

var Admin = mongoose.model('Admin', AdminSchema);
module.exports = Admin;