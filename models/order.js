// Schema file for new documents added via mongoose.

const mongoose = require('mongoose');
const uuidv4 = require('uuid/v4');
const s3Cred = require('../routes/api/s3credentials.js');

// Basic user schema
// Schema is an object that defines the structure of any documents that will be stored in your MongoDB collection; it enables you to define types and validators for all of your data items.
const OrderSchema = new mongoose.Schema({
    id: {
        type: String,
        default: uuidv4(),
        required: true
    },
    customerId: {
        type: String,
        unique: false,
        required: false,
        trim: true
    },
    amountCaptured: {
        type: Number,
        unique: false,
        require: true
    },
    expectedTotal: {
        type: Number,
        unique: false,
        require: true
    },
    chargeId: {
        type: String,
        unique: false,
        required: false
    },
    paymentFulfilled: {
        type: Boolean,
        default: false,
        required: true
    },
    receiptUrl: {
        type: String,
        unique: false,
        required: false
    },
    createdTime: {
        type: Number,
        unique: false,
        required: false
    },
    paymentIntentId: {
        type: String,
        required: false
    },
    paymentMethodId: {
        type: String,
        unique: false,
        required: false
    },
    paymentMethodDetails: {
        type: Object,
        required: false
    },
    billingDetails: {
        type: Object,
        required: false
    },
    outcome: {
        type: Object,
        required: false
    },
    shops: {
        type: Array,
        required: true
    },
    cart: {
        type: Array,
        required: true
    },
    totals: {
        type: Object,
        required: true
    },
    currency: {
        type: String,
        required: false
    },
    proBono: {
        type: Boolean,
        required: false
    }
});


// Model is an object that gives you easy access to a named collection, allowing you to query the collection and use the Schema to validate any documents you save to that collection. It is created by combining a Schema, a Connection, and a collection name.

var Order = mongoose.model('Order', OrderSchema);
module.exports = Order;
