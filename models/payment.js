// Schema file for new documents added via mongoose.

const mongoose = require('mongoose');
const uuidv4 = require('uuid/v4');
const s3Cred = require('../routes/api/s3credentials.js');

// Schema is an object that defines the structure of any documents that will be stored in your MongoDB collection; it enables you to define types and validators for all of your data items.
const PaymentSchema = new mongoose.Schema({
    _id: { 
        type: String, 
        default: uuidv4(),
        required: true
    },
    shopId: {
        type: String,
        unique: false,
        required: true
    },
    completeTotal: {
        type: Number,
        unique: false,
        require: false
    },
    adjustedTotal: {
        type: Number,
        unique: false,
        require: false
    },
    orderId: {
        type: String,
        unique: false,
        required: false
    },
    results: {
        type: String,
        default: false,
        required: true
    },
    note: {
        type: String,
        required: false
    }
});


// Model is an object that gives you easy access to a named collection, allowing you to query the collection and use the Schema to validate any documents you save to that collection. It is created by combining a Schema, a Connection, and a collection name.

var Payment = mongoose.model('Payment', PaymentSchema);
module.exports = Payment;
