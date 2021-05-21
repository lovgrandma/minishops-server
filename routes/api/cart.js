const s3Cred = require('./s3credentials.js');
const neo4j = require('neo4j-driver');
const driver = neo4j.driver(s3Cred.neo.address, neo4j.auth.basic(s3Cred.neo.username, s3Cred.neo.password));

/**
 * Given all the checked update quantities in a product, will update each quantity value of product on the users Neo4j db record
 * @param {String} username 
 * @param {Object[]} productUpdates 
 * @returns {Object || False}
 */
async function setQuantitiesForAllOnUserCart(username, productUpdates) {
    try {
        let session = driver.session();
        let query = "match (a:Person { name: $name }) return a";
        let params = { name: username };
        return await session.run(query, params)
            .then( async (result) => {
                session.close();
                if (result.records[0]._fields[0].properties.cart) {
                    let cart = JSON.parse(result.records[0]._fields[0].properties.cart);
                    productUpdates.forEach((item) => {
                        // Search in users items on database and update them with new quantities using productUpdates array
                        for (let i = 0; i < cart.items.length; i++) {
                            if (item.product.uuid == cart.items[i].uuid && item.product.style == cart.items[i].style && item.product.option == cart.items[i].option) { // good match, update quantity
                                if (item.newQuantity == 0) {
                                    cart.items.splice(i, 1);
                                } else {
                                    cart.items[i].quantity = Number(item.newQuantity);
                                }
                                break;
                            }
                        }
                    });
                    let session2 = driver.session();
                    query = "match (a:Person { name: $name }) set a.cart = $cart return a";
                    params = { name: username, cart: JSON.stringify(cart) };
                    return await session2.run(query, params)
                        .then((result) => {
                            if (result.records[0]._fields[0].properties) {
                                return {
                                    data: productUpdates,
                                    error: null
                                }
                            } else {
                                return false;
                            }
                        })
                        .catch((err) => {
                            return false;
                        })
                } else {
                    return false;
                }
            })
            .catch((err) => {
                return false;
            })
    } catch (err) {
        return false;
    }
};

module.exports = {
    setQuantitiesForAllOnUserCart: setQuantitiesForAllOnUserCart
}