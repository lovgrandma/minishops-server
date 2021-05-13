const s3Cred = require('./s3credentials.js');
const neo4j = require('neo4j-driver');
const uuidv4 = require('uuid/v4');
const driver = neo4j.driver(s3Cred.neo.address, neo4j.auth.basic(s3Cred.neo.username, s3Cred.neo.password));

/**
 * Will get a single product by id and recommendations if asked
 * 
 * @param {String} id 
 * @param {Boolean} recommended 
 * @returns {Object || Boolean false}
 */
const getSingleProductById = async function(id, recommended = false, append = 0) {
    try {
        if (id) {
            let session = driver.session();
            let query = "match (a:Product { id: $id}) return a";
            append += 20; // If append is starting at 0, send 20 products. If append is 100, send back 120 products
            if (recommended) {
                query = "match (a:Product { id: $id})-[r:STOCKS]-(b:Shop)-[r2:OWNS]-(c:Person) optional match (a)-[r3:PURCHASED]-(d)-[r4:PURCHASED]-(e) return a, b, e, c limit $append";
            }
            let params = { id: id, append: neo4j.int(append) };
            let data = {
                shop: {},
                product: {},
                recommended: []
            };
            return await session.run(query, params)
                .then((result) => {
                    if (result.records) {
                        if (result.records[0]) {
                            if (result.records[0]._fields) {
                                if (result.records[0]._fields[1] && result.records[0]._fields[3]) {
                                    if (result.records[0]._fields[1].properties && result.records[0]._fields[3].properties) {
                                        try {
                                            if (result.records[0]._fields[1].properties.shippingClasses) {
                                                result.records[0]._fields[1].properties.shippingClasses = JSON.parse(result.records[0]._fields[1].properties.shippingClasses);
                                            }
                                            data.shop = result.records[0]._fields[1].properties;
                                            if (result.records[0]._fields[3].properties.name) {
                                                data.shop.owner = result.records[0]._fields[3].properties.name;
                                            }
                                        } catch (err) {
                                            data.shop = result.records[0]._fields[1].properties;
                                        }
                                    }
                                }
                                if (result.records[0]._fields[0]) {
                                    if (result.records[0]._fields[0].properties) {
                                        try {
                                            if (result.records[0]._fields[0].properties.images) {
                                                result.records[0]._fields[0].properties.images = JSON.parse(result.records[0]._fields[0].properties.images);
                                            }
                                            if (result.records[0]._fields[0].properties.styles) {
                                                result.records[0]._fields[0].properties.styles = JSON.parse(result.records[0]._fields[0].properties.styles);
                                            }
                                            data.product = result.records[0]._fields[0].properties;
                                        } catch (err) {
                                            data.product = {}; // Product data is corrupted
                                        }
                                        
                                    }
                                }
                            }
                        }
                        // Push recommended
                        if (recommended) {
                            result.records.forEach((record) => {
                                if (record._fields) {
                                    if (record._fields[2]) {
                                        if (record._fields[2].properties) {
                                            data.recommended.push(record._fields[2].properties);
                                        }
                                    }
                                }
                            });
                        }
                    }
                    return data;
                })
                .catch((err) => {
                    console.log(err);
                    return false;
                });
        } else {
            return false;
        }
    } catch (err) {
        console.log(err);
        return false;
    }
}

module.exports = {
    getSingleProductById: getSingleProductById
}