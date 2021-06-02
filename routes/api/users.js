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
const ecommerce = require('./ecommerce.js');
const productHandler = require('./product.js');
const { setQuantitiesForAllOnUserCart } = require('./cart.js');

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

/**
 * Determines if a product contains an appropriate shipping class association to ship to the users country. Otherwise the product cannot be shipped to this persons address
 * @param {String} username 
 * @param {Object} product 
 * @returns {Object || Boolean || String}
 */
const checkValidShippingClass = async(username, product) => {
    try {
        if (product.hasOwnProperty("shopId") && product.hasOwnProperty("id")) {
            let userShippingData = await getUserShippingDataFromDb(username);
            if (!userShippingData) {
                return "No shipping data on user record";
            } else if (!userShippingData.country) {
                return "No shipping data on user record";
            }
            let shop = await ecommerce.getSingleShopById(product.shopId);
            let productData = await productHandler.getSingleProductById(product.id);
            if (userShippingData.hasOwnProperty("country") && shop.hasOwnProperty("shippingClasses") && productData.hasOwnProperty("product")) {
                if (JSON.parse(shop.shippingClasses) && productData.product.hasOwnProperty("shipping")) {
                    let shippingClasses = JSON.parse(shop.shippingClasses);
                    for (let i = 0; i < shippingClasses.length; i++) {
                        if (shippingClasses[i].selectedCountries.indexOf(userShippingData.country) > -1 && productData.product.shipping.indexOf(shippingClasses[i].uuid) > - 1) {
                            return {
                                shippingRule: shippingClasses[i].shippingRule,
                                perProduct: shippingClasses[i].perProduct
                            }
                        }
                    }
                    return false;
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

/**
 * Will check database for user cart. If amount + 1 is less or equal to available quantity left of product, good to add to cart, else fail
 * @param {*} username 
 * @param {*} product 
 */
const addOneProductAction = async(username, product, validDefaultShippingClass) => {
    try {
        let session = driver.session();
        let query = "match (a:Person { name: $username}) return a";
        let params = { username, username };
        // Get user record to determine if they have a cart or not. If no cart, use default object, else use user cart
        let userData = await session.run(query, params)
            .then((result) => {
                session.close();
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
            });
        if (userData) {
            let cart;
            if (userData.hasOwnProperty("cart")) {
                cart = JSON.parse(userData.cart);
            } else {
                cart = {
                    items: [],
                    wishList: []
                }
            }
            // Check current quantity left of product with matching id, style and option
            let session2 = driver.session();
            query = "match (a:Product { id: $id }) return a";
            params = { id: product.id };
            let productDbRecord = await session2.run(query, params)
                .then((result) => {
                    session2.close();
                    if (result) {
                        if (result.records) {
                            if (result.records[0]) {
                                if (result.records[0]._fields) {
                                    if (result.records[0]._fields[0]) {
                                        if (result.records[0]._fields[0].properties) {
                                            if (result.records[0]._fields[0].properties.styles) {
                                                try {
                                                    result.records[0]._fields[0].properties.styles = JSON.parse(result.records[0]._fields[0].properties.styles);
                                                    return result.records[0]._fields[0].properties;
                                                } catch (err) {
                                                    return false;
                                                }
                                            }
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
                });
            if (productDbRecord.styles) {
                let matchProductQuantity = null;
                if (productDbRecord.length == 1 && productDbRecord.styles[0].options.length == 1) { // Only one product style and option, check this quantity
                    matchProductQuantity = productDbRecord.styles[0].options[0].quantity;
                } else {
                    for (let i = 0; i < productDbRecord.styles.length; i++) {
                        if (productDbRecord.styles[i].descriptor == product.style) { // If style matches, iterate through options
                            for (let j = 0; j < productDbRecord.styles[i].options.length; j++) {
                                if (productDbRecord.styles[i].options[j].descriptor == product.option) { // We found the match for the product. Return quantity for comparison
                                    matchProductQuantity = Number(productDbRecord.styles[i].options[j].quantity);
                                }
                            }
                        }
                    }
                }
                function pushOneNewProduct() {
                    cart.items.push({
                        uuid: product.id,
                        quantity: 1,
                        style: product.style,
                        option: product.option,
                        shopId: product.shopId,
                        shippingClass: {
                            shippingRule: validDefaultShippingClass.shippingRule,
                            perProduct: validDefaultShippingClass.perProduct
                        }
                    });
                }
                if (cart.items.length == 0) {
                    if (matchProductQuantity >= 1) {
                        pushOneNewProduct();
                    } else {
                        return {
                            data: {},
                            error: "Not enough product stocked to add more"
                        };
                    }
                } else {
                    let match = false;
                    for (let i = 0; i < cart.items.length; i++) {
                        // If id, style and option the same. It is definitively the same product.
                        if (cart.items[i].uuid == product.id && cart.items[i].style == product.style && cart.items[i].option == product.option) {
                            match = true;
                            cart.items[i].quantity = Number(cart.items[i].quantity) + 1; // Add 1 to quantity
                            if (matchProductQuantity < cart.items[i].quantity) {
                                return {
                                    data: {},
                                    error: "Not enough product stocked to add more"
                                }
                            }
                        }
                    }
                    if (!match) {
                        if (matchProductQuantity >= 1) {
                            pushOneNewProduct();
                        } else {
                            return {
                                data: {},
                                error: "Not enough product stocked to add more"
                            };
                        }
                    }
                }
                if (cart.items.length > 0) {
                    let session3 = driver.session();
                    query = "match (a:Person { name: $username }) set a.cart = $cart return a";
                    params = { cart: JSON.stringify(cart), username: username };
                    return await session3.run(query, params)
                        .then((result) => {
                            session3.close();
                            if (result) {
                                if (result.records) {
                                    if (result.records[0]) {
                                        if (result.records[0]._fields) {
                                            if (result.records[0]._fields[0]) {
                                                if (result.records[0]._fields[0].properties) {
                                                    if (result.records[0]._fields[0].properties.cart) {
                                                        try {
                                                            result.records[0]._fields[0].properties.cart = JSON.parse(result.records[0]._fields[0].properties.cart);
                                                            return {
                                                                data: result.records[0]._fields[0].properties.cart
                                                            }
                                                        } catch (err) {
                                                            return {
                                                                data: {},
                                                                error: "Was not able to add product to cart"
                                                            };
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            return {
                                data: {},
                                error: "Was not able to add product to cart"
                            };
                        })
                        .catch((err) => {
                            return {
                                data: {},
                                error: "Was not able to add product to cart"
                            };
                        });
                } else {
                    return {
                        data: {},
                        error: "Was not able to add product to cart"
                    };
                }
            } else {
                return {
                    data: {},
                    error: "Was not able to add product to cart"
                };
            }
        } else {
            return {
                data: {},
                error: "No valid user data on database"
            };
        }
    } catch (err) {
        return {
            data: {},
            error: "Was not able to add product to cart"
        };
    }
}

const addOneProductToUserCartDb = async(username, product) => {
    // if matching shipping class and product of style and option has quantity over more than users current amt of items in cart, add product to cart w/ default shipping class
    // product should have uuid, quantity, style, option, shop id and selectd shipping class
    // return cart to client
    try {
        let validDefaultShippingClass = await checkValidShippingClass(username, product); // Check shop for matching shipping class. Product must have atleast one matching shipping class that ships to users country
        if (validDefaultShippingClass) {
            if (validDefaultShippingClass == "No shipping data on user record") {
                return {
                    data: {},
                    error: "No shipping data on user record"
                }
            } else {
                let completedCheckValidAddOne = await addOneProductAction(username, product, validDefaultShippingClass);
                if (completedCheckValidAddOne) {
                    if (completedCheckValidAddOne.hasOwnProperty("error")) {
                        return {
                            data: {},
                            error: completedCheckValidAddOne.error
                        }
                    } else {
                        return {
                            data: completedCheckValidAddOne.data
                        }
                    }
                } else {
                    return {
                        data: {},
                        error: "Failed to add product to cart"
                    }
                }
            }
        } else {
            return {
                data: {},
                error: "Product does not ship to your country"
            }
        }
    } catch (err) {
        return {
            data: {},
            error: "Failed to add product to cart"
        }
    }  
}

/**
 * Given the product on the database and the intended new quantity of a product, will determine if quantity set can be satisfied by current amount in stock
 * @param {Object} result 
 * @param {Object} item 
 * @returns {Object || False}
 */
const updateSingleItemQuantity = function(result, item) {
    try {
        if (result.records[0]._fields[0].properties.styles) { // Should throw err if no match and reject false
            let styles = JSON.parse(result.records[0]._fields[0].properties.styles);
            if (styles.length > 1) {
                for (let i = 0; i < styles.length; i++) {
                    if (styles[i].descriptor == item.product.style) {
                        for (let j = 0; j < styles[i].options.length; j++) {
                            if (styles[i].options[j].descriptor == item.product.option) {
                                if (styles[i].options[j].quantity >= item.newQuantity) {
                                    // Quantity of product is greater than quantity user wishes to set, go set
                                    return {
                                        product: item.product,
                                        newQuantity: item.newQuantity,
                                        changedQuantity: false
                                    };
                                } else {
                                    // User set amount too high, set new at item max quantity
                                    return {
                                        product: item.product,
                                        newQuantity: styles[i].options[j].quantity,
                                        changedQuantity: true
                                    };
                                }
                            }
                        }
                    }
                }
            } else { // Only one, must be match
                if (styles[0].options[0].quantity >= item.newQuantity) {
                    return {
                        product: item.product,
                        newQuantity: item.newQuantity,
                        changedQuantity: false
                    };
                } else {
                    return {
                        product: item.product,
                        newQuantity: styles[0].options[0].quantity,
                        changedQuantity: true
                    };
                }
            }
        }
        return false;
    } catch (err) {
        return false;
    }
}

// Will set amount of products or remove product for user cart and return user cart
const setProductsQuantities = async(username, products) => {
    try {
        // update quantities and then call getImagesAndTitlesForCartProductsDb from products.js to get new cart data
        let resolveItemUpdate = products.map(item => {
            return new Promise( async(resolve, reject) => {
                if (item.newQuantity != 0) {
                    let session = driver.session();
                    let query = "match (a:Product { id: $id }) return a";
                    let params = { id: item.product.uuid };
                    session.run(query, params)
                        .then((result) => {
                            session.close();
                            let itemData = updateSingleItemQuantity(result, item);
                            if (itemData) {
                                resolve(itemData);
                            } else {
                                reject(false);
                            }
                        })
                        .catch((err) => {
                            reject(false);
                        })
                } else { // If target user quantity of product is 0, just allow them to remove it from cart
                    resolve({
                        product: item.product,
                        newQuantity: 0,
                        changedQuantity: false
                    });
                }
            });
        });
        let productUpdates = await Promise.all(resolveItemUpdate);
        let result = await setQuantitiesForAllOnUserCart(username, productUpdates);
        if (result) {
            return {
                data: result.data,
                error: result.error
            }
        } else {
            return {
                data: null,
                error: "did not complete"
            }
        }
    } catch (err) {
        return {
            data: null,
            error: "did not complete"
        }
    }
}

module.exports = {
    saveShippingDataToUserRecord: saveShippingDataToUserRecord,
    getUserShippingDataFromDb: getUserShippingDataFromDb,
    addOneProductToUserCartDb: addOneProductToUserCartDb,
    setProductsQuantities: setProductsQuantities
}