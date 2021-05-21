const s3Cred = require('./s3credentials.js');
const neo4j = require('neo4j-driver');
const driver = neo4j.driver(s3Cred.neo.address, neo4j.auth.basic(s3Cred.neo.username, s3Cred.neo.password));
const User = require('../../models/user');

/**
 * https://support.stripe.com/questions/check-if-a-card-is-valid-without-a-charge
 * To prevent card testing, Stripe is sometimes required to not check cvc and zip checks on card validations, so they may appear as “unavailable”. Those checks will be available on the charge object once an actual payment is made. Stripe uses machine learning to predict when card testing is likely.  These checks also may be unavailable as a cost-optimization if Stripe’s machine learning predicts the card is valid and that performing these checks will not increase the probability of a successful payment.
 
 The card information is verified when the card is saved, but it only verifies that the information is valid: it cannot check credit limits or account balances to guarantee that a card will have sufficient funds when you do decide to charge it.

 The card can still be declined or fail for other reasons.
 */

/**
 * Will return a users stored Stripe user for checkout attempt
 * @param {*} username 
 * @returns {String || false}
 */
const getUserStripeAccData = async (username) => {
    try {
        const userRecord = await User.findOne({ username: username }).lean();
        if (userRecord) {
            if (userRecord.payment) {
                return userRecord.payment;
            }
        }
        return false;
    } catch (err) {
        return false;
    }
}

/**
 * Will return the owner of a shops stripe information
 * @param {*} shopId 
 * @returns {String || false}
 */
const getShopStripeData = async (shopId) => {
    try {
        let session = driver.session();
        let query = "match (a:Shop { id: $shopId })-[r:OWNS]-(b:Person) return b";
        let params = { shopId: shopId };
        let username = await session.run(query, params)
            .then((result) => {
                if (result.records[0]._fields[0].properties.name) {
                    return result.records[0]._fields[0].properties.name;
                }
                return false;
            })
            .catch((err) => {
                return false;
            })
        if (username) {
            let shopCCData = await getUserStripeAccData(username);
            if (shopCCData) {
                return {
                    username: username,
                    shopCC: shopCCData
                }
            } else {
                return {
                    username: username,
                    shopCC: null
                }
            }
        }
        return false;
    } catch (err) {
        return false;
    }
}

module.exports = {
    getUserStripeAccData: getUserStripeAccData,
    getShopStripeData: getShopStripeData
}