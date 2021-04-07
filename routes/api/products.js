/**
 * Products interface file products.js
 * @version 0.0.1
 * @author jesse Thompson
 * 
 * Gets and updates products data 
 */

const s3Cred = require('./s3credentials.js');
const neo4j = require('neo4j-driver');
const driver = neo4j.driver(s3Cred.neo.address, neo4j.auth.basic(s3Cred.neo.username, s3Cred.neo.password));

/**
 * Retrieves products paginated from the database
 * 
 * @param {String} owner - The owner of the shop that you want to get from
 * @param {string} filter - The order that products are filtered through 
 * @param {*} append - pagination
 */
const getShopProducts = async function(owner, filter = null, append = 0) {
    let products = [];
    return products;
}

module.exports = {
    getShopProducts: getShopProducts
}