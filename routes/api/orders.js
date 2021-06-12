/**
 * Book keeping file bookkeeping.js
 * This file will be used to store and retrieve order details 
 * @version 0.0.1
 * @author jesse Thompson
 * 
 */

const s3Cred = require('./s3credentials.js');
const Order = require('../../models/order.js');
const Shop = require('../../models/shop.js');
const Payment = require('../../models/payment.js');
const User = require('../../models/user.js');
const neo4j = require('neo4j-driver');
const driver = neo4j.driver(s3Cred.neo.address, neo4j.auth.basic(s3Cred.neo.username, s3Cred.neo.password));
const { convertTime } = require('../utility.js');
const mongoose = require('mongoose');


const getCompletion = async function(items, orderId) {
    let promises = items.map(item => {
        return new Promise(async (resolve, reject) => {
            try {
                const shopData = await Shop.findOne({ _id: item.shopId }).lean();
                item.shipped = false;
                if (!shopData.hasOwnProperty('ordersComplete')) {
                    resolve(item);
                }
                if (shopData.ordersPending.map(function(o) { return o.orderId}).indexOf(orderId) > -1) {
                    resolve(item);
                } else {
                    item.shipped = true;
                    resolve(item);
                }
            } catch (err) {
                // Database record might have been missing ordersPending property
                item.shipped = false; 
                resolve(item);
            }
        });
    });
    return await Promise.all(promises);
};

/**
 * Will get single order from db for receipt
 * @param {*} orderId 
 * @param {*} username 
 * @returns 
 */
const getSingleOrder = async function(orderId, username) {
    try {
        let customer = await User.findOne({ username: username }).lean();
        if (customer.payment) {
            let orderData = await Order.findOne({ id: orderId, customerId: customer.payment }).lean(); // Only get order if belonging to passed user
            if (orderData) {
                orderData.orderInfo = await getCompletion(orderData.cart, orderId);
                if (orderData.createdTime) { // Convert time on server to avoid local convert time issues
                    orderData.convertedTime = convertTime(orderData.createdTime);
                }
                return orderData;
            } else {
                throw new Error;
            }
        } else {
            throw new Error;
        }
    } catch (err) {
        return false;
    }
};

const getAllUserOrders = async function(username) {
    try {
        console.log({username});
        console.log(mongoose.connection);
        const userData = await User.findOne({ username: username }).lean(); // get username cus
        console.log({userData});
        if (userData) {
            if (userData.payment) {
                return await Order.find({ customerId: userData.payment }).lean(); // get all orders in mongodb with matching cus id
            }
        } else {
            throw new Error;
        }
    } catch (err) {
        console.log(err);
        return false;
    }
};

/**
 * Will get orders belonging to single shop. *Remember later to organize orders in Order collection by some accurate checkout data. createdTime not doing what its supposed to, doesnt work
 * @param {*} username 
 * @param {*} append 
 * @returns 
 */
const getShopOrders = async function(username, appendPending = 50, appendCompleted = 50) {
    try {
    let session = driver.session(); // get shop by username
    let query = "match (a:Person { name: $username})-[r:OWNS]-(b:Shop) return b";
    let params = { username: username };
    return await session.run(query, params)
        .then(async (result) => {
            if (result.records[0]._fields[0].properties.id) {
                // Get the matching shop from mongoDb and then get all matching orders within range. Match relevant products in order based on products in cart matching with shop Id
                const shopId = result.records[0]._fields[0].properties.id;
                const matchingShop = await Shop.findOne({ _id: shopId }).lean();
                let ordersPendingIds = [];
                if (matchingShop.ordersPending) {
                    ordersPendingIds = matchingShop.ordersPending.map((order) => { return order.orderId });
                }
                let ordersCompleteIds = [];
                if (matchingShop.ordersComplete) {
                    ordersCompleteIds = matchingShop.ordersComplete.map((order) => { return order.orderId });
                }
                let ordersPending = await Order.find({ id: ordersPendingIds }).lean();
                let ordersComplete = await Order.find({ id: ordersCompleteIds }).lean();
                // Will only present data relevant to shop regarding order
                function cleanOrders(orders, shopId) {
                    let ordersProcessed = orders.slice(0).reverse().map(async (order) => {
                        return new Promise(async (resolve, reject) => {
                            try {
                                delete order.paymentMethodId;
                                delete order.paymentIntentId;
                                delete order.paymentMethodDetails;
                                let validShopCart = [];
                                let orderSubtotal = 0;
                                let orderShipping = 0;
                                for (let i = 0; i < order.cart.length; i++) {
                                    if (order.cart[i].shopId == shopId) {
                                        orderSubtotal += order.cart[i].calculatedTotal ? order.cart[i].calculatedTotal : 0;
                                        orderShipping += order.cart[i].calculatedShipping ? order.cart[i].calculatedShipping  : 0;
                                        validShopCart.push(order.cart[i]);
                                    }
                                }
                                let orderTotal = orderSubtotal + orderShipping;
                                let payoutData = await Payment.findOne({ orderId: order._id, shopId: shopId }, { adjustedTotal: 1, completeTotal: 1 }).lean();
                                let customer = await User.findOne({ payment: order.customerId }).lean();
                                order.userChargedTotalsForShop = {
                                    orderSubtotal: orderSubtotal,
                                    orderShipping: orderShipping,
                                    orderTotal: orderTotal
                                };
                                order.completeTotal = payoutData.completeTotal;
                                order.adjustedTotal = payoutData.adjustedTotal;
                                order.customer = {
                                    username: customer.username ? customer.username : null,
                                    email: customer.email ? customer.email : null
                                };
                                order.time = mongoose.Types.ObjectId(order._id).getTimestamp().toLocaleString(); // Will convert stored _id time as a readable string
                                order.cart = validShopCart;
                                resolve(order);
                            } catch (err) {
                                resolve(order);
                            }
                        });
                    });
                    return Promise.all(ordersProcessed);
                }
                let ordersPendingClean = await cleanOrders(ordersPending, shopId);
                let ordersCompletedClean = await cleanOrders(ordersComplete, shopId);
                return {
                    data: {
                        shopId: shopId,
                        ordersPending: ordersPendingClean,
                        appendPending: appendPending,
                        ordersCompleted: ordersCompletedClean,
                        appendCompleted: appendCompleted
                    },
                    error: null
                }
            }
        })
        .catch((err) => {
            console.log(err);
            return false;
        });
    } catch (err) {
        return false;
    }
};

const moveOrderCompleted = async function(shopId, orderId) {
    try {
        let shopData = await Shop.findOne({ _id: shopId }).lean();
        let orderIndex = shopData.ordersPending.map(function(o) { return o.orderId}).indexOf(orderId);
        let tempOrder = shopData.ordersPending[orderIndex];
         let updated = await Shop.updateOne({ _id: shopId }, 
            { $pull: { ordersPending: { orderId: orderId }}, 
            $push: { ordersComplete: tempOrder }}
        ).lean();
        console.log(updated);
    } catch (err) {
        console.log(err);
        return false;
    }
};

module.exports = {
    getSingleOrder: getSingleOrder,
    getAllUserOrders: getAllUserOrders,
    getShopOrders: getShopOrders,
    moveOrderCompleted: moveOrderCompleted
}