/**
 * Book keeping file bookkeeping.js
 * This file will be used to store and retrieve order details 
 * @version 0.0.1
 * @author jesse Thompson
 * 
 */

const Order = require('../../models/order.js');
const Shop = require('../../models/shop.js');
const Payment = require('../../models/payment.js');
const { convertTime } = require('../utility.js');


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
        let orderData = await Order.findOne({ _id: orderId }).lean();
        if (orderData) {
            orderData.orderInfo = await getCompletion(orderData.cart, orderId);
            if (orderData.createdTime) { // Convert time on server to avoid local convert time issues
                orderData.convertedTime = convertTime(orderData.createdTime);
            }
            return orderData;
        } else {
            return false;
        }
    } catch (err) {
        return false;
    }
};

const getAllUserOrders = async function(username) {
    // get username cus id
    // get all orders in mongodb with matching cus id
};

module.exports = {
    getSingleOrder: getSingleOrder
}