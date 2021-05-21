/**
 * Ecommerce file ecommerce.js
 * This file will be used to cart management and checkout
 * @version 0.0.1
 * @author jesse Thompson
 * 
 */

const s3Cred = require('./s3credentials.js');
const s3Upload = require('./s3upload.js');
const neo4j = require('neo4j-driver');
const uuidv4 = require('uuid/v4');
const driver = neo4j.driver(s3Cred.neo.address, neo4j.auth.basic(s3Cred.neo.username, s3Cred.neo.password));
const { setQuantitiesForAllOnUserCart } = require('./cart.js');

const getSingleShopById = async(id) => {
    try {
        let query = "match (a:Shop {id: $id}) return a";
        let params = { id: id };
        let session = driver.session();
        return await session.run(query, params)
            .then((result) => {
                if (result) {
                    if (result.records) {
                        if (result.records[0]) {
                            if (result.records[0]._fields) {
                                if (result.records[0]._fields[0]) {
                                    if (result.records[0]._fields[0].properties) {
                                        return result.records[0]._fields[0].properties;
                                    }
                                }
                            }
                        }
                    }
                }
                return false;
            })
            .catch((err) => {
                return false;
            })
    } catch (err) {
        return false;
    }
}

/**
 * Gets single cart from user record
 * 
 * @param {String} username 
 * @returns {Object || Boolean}
 */
const getCart = async(username) => {
    try {
        if (username) {
            let session = driver.session();
            let query = "match (a:Person { name: $username }) return a";
            let params = { username: username };
            return await session.run(query, params)
                .then((result) => {
                    session.close();
                    if (result.records[0]._fields[0].properties.cart) {
                        try { 
                            return JSON.parse(result.records[0]._fields[0].properties.cart);
                        } catch (err) {
                            return false;
                        }
                    }
                    return false;
                })
                .catch((err) => {
                    return false;
                })
        }
    } catch (err) {
        return false;
    }
}

/**
 * Used pre final checkout before charging users card. If valid quantities, process, else advise user cart updates
 * 
 */
const resolveCartQuantities = async(data, username) => {
    try {
        let singleQuantityChange = false;
        let checkProductQuantity = data.items.map((item) => {
            return new Promise(async (resolve, reject) => {
                try {
                    let session = driver.session();
                    let query = "match (a:Product { id: $id }) return a";
                    let params = { id: item.uuid };
                    let queryData = await session.run(query, params)
                        .then((result) => {
                            result.records[0]._fields[0].properties.styles = JSON.parse(result.records[0]._fields[0].properties.styles);
                            return result.records[0]._fields[0].properties;
                        })
                        .catch ((err) => {
                            return false;
                        })
                    if (queryData) {
                        // If quantity of product in cart is equal to or less than product stock, quantity of purchasable amount has been resolved, else reduce and update user
                        if (queryData.styles.length == 1) {
                            if (queryData.styles[0].options.length == 1) {
                                if (item.quantity <= queryData.styles[0].options[0].quantity) {
                                    item = {
                                        product: item,
                                        newQuantity: item.quantity,
                                        changedQuantity: false
                                    }
                                } else {
                                    singleQuantityChange = true;
                                    item = {
                                        product: item,
                                        newQuantity: queryData.styles[0].options[0].quantity,
                                        changedQuantity: true
                                    }
                                }
                                resolve(item);
                            }
                        }
                        for (let i = 0; i < queryData.styles.length; i++) {
                            if (queryData.styles[i].descriptor == item.style) {
                                for (let j = 0; j < queryData.styles[i].options.length; j++) {
                                    if (queryData.styles[i].options[j].descriptor == item.option) {
                                        if (item.quantity <= queryData.styles[i].options[j].quantity) {
                                            item = {
                                                product: item,
                                                newQuantity: item.quantity,
                                                changedQuantity: false
                                            }
                                        } else {
                                            singleQuantityChange = true;
                                            item = {
                                                product: item,
                                                newQuantity: queryData.styles[i].options[j].quantity,
                                                changedQuantity: true
                                            }
                                        }
                                        resolve(item);
                                    }
                                }
                            }
                        }
                        reject(item);
                    } else {
                        reject(item);
                    }
                } catch (err) {
                    reject(item);
                }
            });
        });
        let checkedProductQuantitiesObject = await Promise.all(checkProductQuantity);
        if (singleQuantityChange) { // There was a change in quantity during checkout process, necessary to update user db cart
            return await setQuantitiesForAllOnUserCart(username, checkedProductQuantitiesObject)
                .then((result) => {
                    return checkedProductQuantitiesObject;
                })
                .catch((err) => {
                    return false;
                });
        } else {
            return checkedProductQuantitiesObject;
        }
    } catch (err) {
        return false;
    }
}

module.exports = {
    getSingleShopById: getSingleShopById,
    getCart: getCart,
    resolveCartQuantities: resolveCartQuantities
}