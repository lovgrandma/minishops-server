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

module.exports = {
    getSingleShopById: getSingleShopById
}