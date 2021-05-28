/**
 * Book keeping file bookkeeping.js
 * This file will be used to store and retrieve order details 
 * @version 0.0.1
 * @author jesse Thompson
 * 
 */

const Order = require('../../models/order.js');
const Shop = require('../../models/shop.js');
const uuidv4 = require('uuid/v4');

/**
 * If this method is being called we have to make a record by any means because this suggests a user was charged or a transaction occurs. We cannot have transactions without records. This is of utmost importance. Even if nearly all the passed arguments are invalid or null we need to retrieve what data we can to build the record and reconcile it later with the customer
 * @param {*} data 
 * @param {*} charged 
 * @param {*} requiresReview 
 * @returns {Object || false} saved record
 */
const saveOrderFulfillmentRecord = async function(data, userStripeData, charged, requiresReview = false, proBono = false) {
    try {
        var order = {
            _id: await makeNewOrderUuid(),
            customerId: null,
            amountCaptured: null,
            expectedTotal: null,
            chargeId: null,
            paymentFulfilled: false,
            receiptUrl: "",
            createdTime: null,
            paymentIntentId: null,
            paymentMethodId: null,
            paymentMethodDetails: null,
            billingDetails: null,
            outcome: null,
            shops: [],
            cart: [],
            totals: null,
            currency: null,
            proBono: false
        };
        if (charged) {
            if (charged.hasOwnProperty("paymentIntent")) {
                order.customerId = userStripeData;
                if (charged.paymentIntent.hasOwnProperty("amount_received")) {
                    order.amountCaptured = charged.paymentIntent.amount_received; // Amount processed to Minipost LLC
                }
                if (charged.paymentIntent.hasOwnProperty("amount")) {
                    order.expectedTotal = charged.paymentIntent.amount; // Amount expected to be received
                }
                if (charged.paymentIntent.hasOwnProperty("id")) {
                    order.paymentIntentId = charged.paymentIntent.id;
                }
                if (charged.paymentIntent.hasOwnProperty("charges")) {
                    if (charged.paymentIntent.charges.hasOwnProperty("data")) {
                        if (charged.paymentIntent.charges.data[0]) {
                            if (charged.paymentIntent.charges.data[0].hasOwnProperty("id")) {
                                order.chargeId = charged.paymentIntent.charges.data[0].id;
                            }
                            if (charged.paymentIntent.charges.data[0].hasOwnProperty("receipt_url")) {
                                order.receiptUrl = charged.paymentIntent.charges.data[0].receipt_url;
                            }
                            if (charged.paymentIntent.charges.data[0].hasOwnProperty("created")) {
                                order.createdTime = charged.paymentIntent.charges.data[0].created;
                            }
                            if (charged.paymentIntent.hasOwnProperty("payment_method")) {
                                order.paymentMethodId = charged.paymentIntent.payment_method;
                            }
                            if (charged.paymentIntent.charges.data[0].hasOwnProperty("payment_method_details")) {
                                order.paymentMethodDetails = charged.paymentIntent.charges.data[0].payment_method_details;
                            }
                            if (charged.paymentIntent.charges.data[0].hasOwnProperty("billing_details")) {
                                order.billingDetails = charged.paymentIntent.charges.data[0].billing_details;
                            }
                            if (charged.paymentIntent.charges.data[0].hasOwnProperty("outcome")) {
                                order.outcome = charged.paymentIntent.charges.data[0].outcome;
                            }
                            if (charged.paymentIntent.charges.data[0].hasOwnProperty("currency")) {
                                order.currency = charged.paymentIntent.charges.data[0].currency;
                            }
                        }
                    }
                }
                if (order.amountCaptured == order.expectedTotal && !proBono || proBono) {
                    order.paymentFulfilled = true;
                }
                if (charged.paymentIntent.hasOwnProperty("id")) {
                    order.paymentIntent = charged.paymentIntent.id;
                }
            }
        }
        if (data) {
            if (data.hasOwnProperty("checkoutTruths")) {
                if (data.checkoutTruths.hasOwnProperty("shop")) {
                    order.shops = data.checkoutTruths.shop;
                }
                if (data.checkoutTruths.hasOwnProperty("cart")) {
                    order.cart = data.checkoutTruths.cart;
                }
                if (data.checkoutTruths.hasOwnProperty("totals")) {
                    order.totals = data.checkoutTruths.totals;
                }
            }
        }
        if (proBono) {
            order.proBono = true;
        }
        let savedRecord = await Order.create(order);
        return savedRecord;
    } catch (err) {
        try {
            return await Order.create(order);
        } catch (err) {
            return false;
        }
    }
}

/**
 * Orders are necessarily associated with shops so that shops can organize all relevant orders to fulfill and completed order history
 * User orders are simply retrieved by customer payment ID. Orders will always have a customer ID (payment id) attached
 * @param {*} shop 
 * @param {*} order 
 */
const associateOrderWithShop = async function(shop, order) {
    return new Promise(async (resolve, reject) => {
        try {
            let data = await Shop.updateOne({ _id: shop}, { $push: { ordersPending: order }}, { upsert: true, new: true} );
            resolve(data);
        } catch (err) {
            reject(err);
        }
    })
};

/** Checks if order with uuid exists already. Checks 5 times if uniquely generated random uuid is matched 5 times in a row */
const makeNewOrderUuid = async (uuid = "") => {
    let uniqueUuid = 0;
    do {
        uuid = uuidv4().split("-").join("");
        let result = await Order.findOne({ _id: uuid });
        if (!result) { // No result found, uuid can safely be used for this user
            uniqueUuid = 5;
            return uuid;
        } else {
            uniqueUuid++;
        }
    } while (uniqueUuid < 5);
    // If randomly matches 5 uuid's, just return a randomly generated uuid and hope it does not match. 1 in several billion chance of running. Will pass error to client if matches again preventing crash
    return uuidv4();
}


module.exports = {
    saveOrderFulfillmentRecord: saveOrderFulfillmentRecord,
    associateOrderWithShop: associateOrderWithShop
}