const s3Cred = require('./s3credentials.js');
const neo4j = require('neo4j-driver');
const testkey = s3Cred.stripe.testkey;
const key = s3Cred.stripe.key;
const uuidv4 = require('uuid/v4');
const driver = neo4j.driver(s3Cred.neo.address, neo4j.auth.basic(s3Cred.neo.username, s3Cred.neo.password));
const User = require('../../models/user');
const Payment = require('../../models/payment');
const Stripe = require('stripe');
let stripe;
if (process.env.dev) {
    stripe = Stripe(testkey); 
} else {
    stripe = Stripe(key); // Load production live key if environment is production
}

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

const getShopStripeVendorPaymentData = async (username) => {
    try {
        const shopRecord = await User.findOne({ username: username }).lean();
        if (shopRecord) {
            if (shopRecord.vendorPayment) {
                return shopRecord.vendorPayment;
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
            let shopAccData = await getShopStripeVendorPaymentData(username);
            if (shopAccData) {
                return {
                    username: username,
                    shopAcc: shopAccData
                }
            } else {
                return {
                    username: username,
                    shopAcc: null
                }
            }
        }
        return false;
    } catch (err) {
        return false;
    }
}

/**
 * Will retrieve first account credit card
 * @param {*} customerPaymentId 
 * @returns {Object || false}
 */
const getAccountCCs = async (customerPaymentId) => {
    try {
        const cards = await stripe.paymentMethods.list({ customer: customerPaymentId, type: 'card' });
        if (cards) {
            return cards;
        }
        return false;
    } catch (err) {
        return false;
    }
}

/** Quickly checks if use account CC data is valid with atleast 1 card. If no card, user must add card
* @param {Object} accountCCsData
* @returns {Boolean}
*/
const validateAccountCCsData = function(accountCCsData) {
    if (!accountCCsData) {
        return false;
    }
    if (!accountCCsData.hasOwnProperty("data")) {
        return false;
    }
    if (accountCCsData.data.length == 0) {
        return false;
    }
    return true;
}

/**
 * Receives total in float format. Converts by multiplying by 100 to cents value for Stripe API
 * @param {*} accountCCsData 
 * @param {*} total 
 * @returns 
 */
const chargeFirstValidCard = async (accountCCsData, cusId, total) => {
    try {
        total = parseFloat(total);
        total = Math.round(total*100); // Convert cost value into equivalent cents format. E.g 17.49 = 1749 cents. Charge user in cents for Stripe compliance
        if (!cusId) {
            return {
                paymentIntent: null,
                accountCCsData: accountCCsData ? accountCCsData : null,
                cusId: cusId ? cusId : null,
                total: total ? total : null,
                amountCharged: 0,
                notice: "Customer id is missing, please contact Minipost administration",
                error: "Charge failed, account was not charged"
            }
        }
        if (!accountCCsData || !total || typeof total != 'number' || isNaN(total)) {
            return {
                paymentIntent: null,
                accountCCsData: accountCCsData ? accountCCsData : null,
                cusId: cusId ? cusId : null,
                total: total ? total : null,
                amountCharged: 0,
                notice: "Something went wrong during payment",
                error: "Charge failed, account was not charged"
            }
        }
        if (accountCCsData.hasOwnProperty('data')) {
            if (accountCCsData.data[0]) {
                if (accountCCsData.data[0].id) {
                    const paymentIntent = await stripe.paymentIntents.create({
                        amount: total,
                        currency: 'usd',
                        payment_method_types: ['card'],
                        confirm: true,
                        customer: cusId,
                        payment_method: accountCCsData.data[0].id
                    });
                    if (paymentIntent) {
                        if (paymentIntent.hasOwnProperty('charges')) {
                            if (paymentIntent.charges.hasOwnProperty('data')) {
                                if (paymentIntent.charges.data.length == 0) {
                                    return false;
                                } else {
                                    // Account was charged with atleast a single charge
                                    if (total != paymentIntent.amount_received) {
                                        // Account was charged but the amount we were supposed to charge was not the same as what was charged
                                        return {
                                            paymentIntent: paymentIntent,
                                            accountCCsData: accountCCsData,
                                            cusId: cusId,
                                            total: total,
                                            amountCharged: paymentIntent.amount_received,
                                            notice: "Was not charged total amount",
                                            error: null
                                        }
                                    } else {
                                        // Account was charged
                                        return {
                                            paymentIntent: paymentIntent,
                                            accountCCsData: accountCCsData,
                                            cusId: cusId,
                                            total: total,
                                            amountCharged: paymentIntent.amount_received,
                                            notice: "Success",
                                            error: null
                                        }
                                    }
                                }
                            }
                        }
                    }
                    return {
                        paymentIntent: paymentIntent,
                        accountCCsData: accountCCsData,
                        cusId: cusId,
                        total: total,
                        amountCharged: null,
                        notice: "Something went wrong during payment",
                        error: "Charge failed, account was not charged"
                    }
                } else {
                    return {
                        paymentIntent: null,
                        accountCCsData: accountCCsData ? accountCCsData : null,
                        cusId: cusId ? cusId : null,
                        total: total ? total : null,
                        amountCharged: 0,
                        notice: "No valid account card",
                        error: "Charge failed, account was not charged"
                    }
                }
            } else {
                return {
                    paymentIntent: null,
                    accountCCsData: accountCCsData ? accountCCsData : null,
                    cusId: cusId ? cusId : null,
                    total: total ? total : null,
                    amountCharged: 0,
                    notice: "No valid account card",
                    error: "Charge failed, account was not charged"
                }
            }
        } else {
            return {
                paymentIntent: null,
                accountCCsData: accountCCsData ? accountCCsData : null,
                cusId: cusId ? cusId : null,
                total: total ? total : null,
                amountCharged: 0,
                notice: "No valid account card",
                error: "Charge failed, account was not charged"
            }
        }
    } catch (err) {
        const cancelledPaymentIntent = await stripe.paymentIntents.cancel(
            paymentIntent.id
        );
        return {
            paymentIntent: paymentIntent ? paymentIntent : null,
            accountCCsData: accountCCsData ? accountCCsData : null,
            cusId: cusId ? cusId : null,
            total: total ? total : null,
            amountCharged: 0,
            notice: "Something went wrong during payment",
            error: "Charge failed, account was not charged"
        }
    }
}

const getAdjustedRate = async function(shopId) {
    let session = driver.session();
    let query = "match (a:Shop {id: $id}) return a";
    let params = { id: shopId };
    return await session.run(query, params)
        .then((result) => {
            if (result.records[0]._fields[0].properties.rate) {
                return result.records[0]._fields[0].properties.rate;
            }
            return 0.948; // default 5.2% rate
        })
        .catch((err) => {
            return 0.948;
        })
}

/**
 * We will store payment records individually in payment collection. Determines truthiness of actual payments
 * @param {*} paymentRecord 
 */
const recordPaymentRecord = async function(paymentRecord, note = "") {
    try {
        async function resolvePaymentUuid() {
            let uniqueUuid = 0;
            do {
                uuid = uuidv4();
                let result = await Payment.findOne({ _id: uuid });
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
        let outBoundPayment = {
            _id: await resolvePaymentUuid(),
            shopId: null,
            completeTotal: null,
            adjustedTotal: null,
            orderId: null,
            results: null
        }
        if (paymentRecord.shop) {
            outBoundPayment.shopId = paymentRecord.shop;
        }
        if (paymentRecord.completeTotal) {
            outBoundPayment.completeTotal = paymentRecord.completeTotal;
        }
        if (paymentRecord.adjustedTotal) {
            outBoundPayment.adjustedTotal = paymentRecord.adjustedTotal;
        }
        if (paymentRecord.orderId) {
            outBoundPayment.orderId = paymentRecord.orderId;
        }
        if (paymentRecord.results) {
            outBoundPayment.results = paymentRecord.results;
        }
        outBoundPayment.note = note;
        if (outBoundPayment.shopId) {
            let recordedPayment = await Payment.create(outBoundPayment);
            return recordedPayment._id;
        } else {
            return null;
        }
    } catch(err) {
        console.log(err);
        return null;
    }
}

/**
 * Will pay single vendor. possible results values = [ "balance_insufficient", "completed", "failed" ]
 * @param {*} paymentShopData 
 * @returns 
 */
const paySingleVendor = async (paymentShopData) => {
    return new Promise(async(resolve, reject) => {
        try {
            // run stripe payment intent
            let shopStripeData = await getShopStripeData(paymentShopData.shop);
            let total = paymentShopData.completeTotal;
            let adjustedRate = await getAdjustedRate(paymentShopData.shop);
            console.log(total, adjustedRate);
            let adjustedTotal = total * adjustedRate;
            console.log(adjustedTotal);
            let stripeSafeTotal = Math.round(adjustedTotal * 100);
            console.log(stripeSafeTotal);
            let shopPaymentAcc = shopStripeData.shopAcc;
            paymentShopData.adjustedRate = adjustedRate;
            paymentShopData.adjustedTotal = parseFloat(adjustedTotal.toFixed(2));
            if (total && shopPaymentAcc) {
                try {
                    const transfer = await stripe.transfers.create({
                        amount: stripeSafeTotal,
                        currency: 'usd',
                        destination: shopPaymentAcc
                    });
                    paymentShopData.results = "completed";
                    paymentShopData.paymentReceipt = await recordPaymentRecord(paymentShopData);
                    resolve(paymentShopData);
                } catch (err) {
                    console.log(err);
                    paymentShopData.results = err.code;
                    paymentShopData.paymentReceipt = await recordPaymentRecord(paymentShopData);
                    resolve(paymentShopData);
                }
            } else {
                paymentShopData.results = "failed";
                resolve(paymentShopData);
            }
            
        } catch (err) {
            console.log(err);
            paymentShopData.results = "failed";
            resolve(paymentShopData);
        }
    });
}

module.exports = {
    getUserStripeAccData: getUserStripeAccData,
    getShopStripeData: getShopStripeData,
    getAccountCCs: getAccountCCs,
    validateAccountCCsData: validateAccountCCsData,
    chargeFirstValidCard: chargeFirstValidCard,
    paySingleVendor: paySingleVendor
}