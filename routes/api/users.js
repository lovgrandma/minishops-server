/**
 * User interface file users.js
 * Will be used to save shipping data, get user cart data, change cart data etc
 * @version 0.0.1
 * @author jesse Thompson
 * 
 * Gets and updates users data 
 */

const s3Cred = require('./s3credentials.js');
const neo4j = require('neo4j-driver');
const driver = neo4j.driver(s3Cred.neo.address, neo4j.auth.basic(s3Cred.neo.username, s3Cred.neo.password));
const User = require('../../models/user');

/**
 * Will take data from user input shipping data and ensure that it is in the right format before submitting to database
 * @param {*} shippingData 
 * @returns 
 */
const validateShipping = (shippingData) => {
    try {
        let shippingValidated = {
            country: "",
            fullName: "",
            email: "",
            address: "",
            city: "",
            state: "",
            zip: ""
        }
        for (const [key, value] of Object.entries(shippingValidated)) {
            if (shippingData.hasOwnProperty(`${key}`) && shippingData[key].length > 0) {
                shippingValidated[key] = shippingData[key];
            } else {
                return false;
            }
        }
        return shippingValidated;
    } catch (err) {
        return false;
    }
}

const saveShippingDataToUserRecord = async(username, shippingData) => {
    try {
        if (shippingData) {
            let goodShippingData = validateShipping(shippingData);
            if (goodShippingData) {
                let updatedMongoUser = await User.findOneAndUpdate({ username: username }, { shipping: goodShippingData }, { new: true }).lean();
                if (updatedMongoUser.hasOwnProperty("shipping")) {
                    return updatedMongoUser.shipping;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        } else {
            return false;
        }
    } catch (err) {
        return false;
    }
}

const getUserShippingDataFromDb = async(username) => {
    try {
        if (username) {
            let mongoUserRecord = await User.findOne({ username: username}).lean();
            if (mongoUserRecord.hasOwnProperty("shipping")) {
                return mongoUserRecord.shipping;
            } else {
                return false;
            }
        } else {
            return false;
        }
    } catch (err) {
        return false;
    }
}

const addOneProductToUserCartDb = async(username, product) => {
    // check product shop for a matching shipping class, if no matching shipping class return false failed to add to cart
    // if matching shipping class and product of style and option has quantity over more than users current amt of items in cart, add product to cart w/ default shipping class
    // product should have uuid, quantity, style, option, shop id and selectd shipping class
    // return cart to client
}

module.exports = {
    saveShippingDataToUserRecord: saveShippingDataToUserRecord,
    getUserShippingDataFromDb: getUserShippingDataFromDb,
    addOneProductToUserCartDb: addOneProductToUserCartDb
}