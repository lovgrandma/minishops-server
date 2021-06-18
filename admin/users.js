/**
 * Administrator file for template queries to create and manage shops on neo4j and mongoDb users.js
 * @version 0.0.1
 * @author jesse Thompson
 */

const s3Cred = require('../routes/api/s3credentials.js');
const neo4j = require('neo4j-driver');
const driver = neo4j.driver(s3Cred.neo.address, neo4j.auth.basic(s3Cred.neo.username, s3Cred.neo.password));
const uuidv4 = require('uuid/v4');
const User = require('../models/user.js');
const Shop = require('../models/shop.js');
const testkey = s3Cred.stripe.testkey;
const key = s3Cred.stripe.key;
const Stripe = require('stripe');
let stripe;
if (process.env.dev) {
    stripe = Stripe(testkey); 
} else {
    stripe = Stripe(key); // Load production live key if environment is production
}

/**************************************** */
//Creating a single shop with shop Stripe payment account

/**
 * Builds shop belonging to user on neo4j to allow them to begin configuring their shop
 * Ledger will contain a list of all users transactions, application will delete transactions (complete or uncomplete) after 1 year. 
 * Products are not on shop, they are individual records connected to shop record
 */

const buildAShop = async function(id, name, owner, description, publishDate, icon) {
    let q = await getSingleShopAndAttachToAccountQuery(id, name, owner, description, publishDate, icon);
    if (q) {
        let session = driver.session();
        console.log(q);
        let sh = await session.run(q.query, q.params);
        let ex = await retrieveExpressVendorAcc(owner);
        if (sh && ex) {
            return true;
        }
    } else {
        return false;
    }
}

// Whenever you build a shop, make sure to create default vendor payment account 
// "create (a:Shop { id: $id, name: $name, ledger: [], authorized: true, publishDate: $publishDate, description: $description, icon: $icon, shippingClasses: [], origins: [] }) with a match (b:Person {name: $name }) with a, b merge (b)-[r:OWNS]-(a) return a, r, b"
const getSingleShopAndAttachToAccountQuery = async (id, name, owner, description, publishDate = null, icon = null ) => {
    async function resolveShopUuid() {
        let uniqueUuid = 0;
        let uuid;
        do {
            uuid = uuidv4();
            let session = driver.session();
            let result = await session.run("match (a:Shop { id: $uuid }) return a", { uuid: uuid });
            if (result.records.length == 0) { // No result found, uuid can safely be used for this user
                uniqueUuid = 5;
                return uuid;
            } else {
                uniqueUuid++;
            }
        } while (uniqueUuid < 5);
        // If randomly matches 5 uuid's, just return a randomly generated uuid and hope it does not match. 1 in several billion chance of running. Will pass error to client if matches again preventing crash
        return uuidv4();
    }
    id = id ? id : await resolveShopUuid();
    publishDate  = publishDate ? publishDate : neo4j.int(new Date().getTime());
    if (id && name && description && owner) {
        return {
            query: "create (a:Shop { id: $id, name: $name, ledger: [], authorized: true, publishDate: $publishDate, description: $description, icon: $icon, shippingClasses: [], origins: [] }) with a match (b:Person {name: $owner }) with a, b merge (b)-[r:OWNS]-(a) return a, r, b",
            params: { 
                id: id,
                name: name,
                description: description,
                publishDate: publishDate,
                icon: icon,
                owner: owner
            }
        }
    } else {
        return false;
    }
}

/**
 * Will enforce a Singleton express account on a shop account
 * @param {String} username 
 * @returns {String}
 */
const retrieveExpressVendorAcc = async function(username) {
    try {
        let oldUser = await User.findOne({ username: username }).lean();
        console.log(oldUser);
        if (!oldUser.vendorPayment) { // Creates new vendor account if null
            // It is necessary that new vendor accounts are initiated with card_payments and transfers enabled. Or else they cannot receive payments
            const account = await stripe.accounts.create({
                type: 'express',
                capabilities: {
                    card_payments: {
                        requested: true,
                    },
                    transfers: {
                        requested: true,
                    }
                }
            });
            let updatedUser = await User.findOneAndUpdate({ username: username}, { vendorPayment: account.id }, { new: true }).lean();
            // Force make shop record for mongoDb here
            // Find user owned shop on neo4j,
            // get user shop id
            // create new shop {
            //         _id: String,
            //         ordersPending: Array,
            //         ordersComplete: Array
            // }
            let query = "match (a:Person { name: $username })-[:OWNS]-(b:Shop) return b";
            let params = { username: username };
            let session = driver.session();
            console.log(query, params);
            let shopId = await session.run(query, params)
                .then((result) => {
                    return result.records[0]._fields[0].properties.id;
                })
                .catch((err) => {
                    return false;
                });
            await Shop.create({
               _id: shopId,
               ordersPending: [],
               ordersComplete: [] 
            });
            return updatedUser.vendorPayment;
        } else {
            return oldUser.vendorPayment; // Returns vendor account if existing
        }
    } catch (err) {
        console.log(err);
        return null;
    }
}

/*************************************** */

module.exports = {
    buildAShop: buildAShop
}