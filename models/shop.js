// Schema file for new documents added via mongoose.

const mongoose = require('mongoose');
const uuidv4 = require('uuid/v4');
const s3Cred = require('../routes/api/s3credentials.js');

// Basic user schema
// Schema is an object that defines the structure of any documents that will be stored in your MongoDB collection; it enables you to define types and validators for all of your data items.
const ShopSchema = new mongoose.Schema({
    _id: { 
        type: String, 
        default: uuidv4(),
        required: true
    },
    ordersPending: {
        type: Array,
        required: true
    },
    ordersComplete: {
        type: Array,
        required: true
    }
});


// Model is an object that gives you easy access to a named collection, allowing you to query the collection and use the Schema to validate any documents you save to that collection. It is created by combining a Schema, a Connection, and a collection name.

var Shop = mongoose.model('Shop', ShopSchema);
module.exports = Shop;