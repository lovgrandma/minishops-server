/**
 * Products interface file products.js
 * @version 0.0.1
 * @author jesse Thompson
 * 
 * Gets and updates products data 
 */

const s3Cred = require('./s3credentials.js');
const s3Upload = require('./s3upload.js');
const neo4j = require('neo4j-driver');
const uuidv4 = require('uuid/v4');
const driver = neo4j.driver(s3Cred.neo.address, neo4j.auth.basic(s3Cred.neo.username, s3Cred.neo.password));

/**
 * Retrieves products paginated from the database
 * 
 * @param {String} owner - The owner of the shop that you want to get from
 * @param {string} filter - The order that products are filtered through 
 * @param {number} append - pagination
 */
const getShopDbProducts = async function(owner, filter = null, append = 0) {
    try {
        append += 10;
        let session = driver.session();
        let query = "match (a:Person { name: $owner })-[r:OWNS]-(b:Shop)-[r2:STOCKS]-(c:Product) return c limit $append";
        let params = { owner: owner, append: neo4j.int(append) };
        return await session.run(query, params)
            .then(async function(result) {
                session.close();
                let products = [];
                if (result) {
                    if (result.records) {
                        result.records.forEach((record, index) => {
                            if (record._fields) {
                                if (record._fields[0]) {
                                    if (record._fields[0].properties) {
                                        record._fields[0].properties.styles = JSON.parse(record._fields[0].properties.styles);
                                        try {
                                            record._fields[0].properties.images = JSON.parse(record._fields[0].properties.images); // Use try catch as record may not have images field, but it should
                                        } catch (err) {
                                            // fail silently
                                        }
                                        for (let i = 0; i < record._fields[0].properties.styles[i].length; i++) {
                                            for (let j = 0; j < record._fields[0].properties.styles[i].options.length; j++) {
                                                record._fields[0].properties.styles[i].options[j].price = parseFloat(record._fields[0].properties.styles[i].options[j].price).toFixed(2); // Parse stored price to valid number
                                            }
                                        }
                                        products.push(record._fields[0].properties);
                                    }
                                }
                            }
                        })
                        return products;
                    }
                }
                return [];
            });
    } catch (err) {
        return [];
    }
}

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

/**
 * Will get single product matched by id name. Similar to get single product by id but strictly used to determine truthiness of product record or single values of product
 * 
 * @param {String} id 
 * @returns {Object || Boolean false}
 */
const findProductById = async function(id) {
    try {
        if (id) {
            let session = driver.session();
            let query = "match (a:Product {id: $id }) return a"; // Match product by unique product id
            let params = { id: id };
            return await session.run(query, params)
                .then(async function(result) {
                    session.close();
                    if (result) {
                        if (result.records) {
                            if (result.records[0]) {
                                return result.records[0];
                            }
                        }
                    }
                    return false;
                })
        } else {
            return false;
        }
    } catch (err) {
        return false;
    }
}

/**
 * Goes through a product object and determines if all properties are valid. Then builds new.
 * This is also done on a lower level on the front end but we cannot trust the front end
 * 
 * @param {Object} product 
 * @returns {Object || Boolean} Completion
 */
const validateProduct = function(product) {
    try {
        let validProduct = {
            id: "",
            name: "",
            description: "",
            styles: [],
            shipping: [],
            images: [],
            published: false
        };
        if (product) {
            if (product.hasOwnProperty("id")) {
                if (product.id != "dummyid" && product.id.length > 0) { // confirm that the id is not dummy or null for merge, else new
                    validProduct.id = product.id;
                }
            }
            if (product.hasOwnProperty("name")) {
                if (product.name.length > 0) {
                    validProduct.name = product.name;
                } else {
                    return false;
                }
            } else {
                return false;
            }
            if (product.hasOwnProperty("description")) {
                validProduct.description = product.description;
            }
            if (Array.isArray(product.styles)) {
                for (let i = 0; i < product.styles.length; i++) {
                    // Ensure that if there are several styles, they must all be named. If only 1 style then it does not have to be named
                    if (product.styles.length > 1) {
                        if (product.styles[i].hasOwnProperty("descriptor")) {
                            if (product.styles[i].descriptor.length < 1) {
                                return false;
                            }
                        } else {
                            return false;
                        }
                    }
                    for (let j = 0; j < product.styles[i].options.length; j++) {
                        if (product.styles[i].options.length > 1) {
                            if (product.styles[i].options[j].hasOwnProperty("descriptor")) {
                                if (product.styles[i].options[j].descriptor.length < 1) {
                                    return false;
                                }
                                if (typeof product.styles[i].options[j].price !== "number") {
                                    return false;
                                }
                            } else {
                                return false;
                            }
                        }
                    }
                }
            }
            let validStyles = [];
            for (let i = 0; i < product.styles.length; i++) {
                let thisOptions = [];
                for (let j = 0; j < product.styles[i].options.length; j++) {
                    thisOptions.push({
                        descriptor: product.styles[i].options[j].descriptor,
                        price: Number(parseFloat(product.styles[i].options[j].price).toFixed(2)),
                        quantity: product.styles[i].options[j].quantity
                    })
                }
                validStyles.push({
                    descriptor: product.styles[i].descriptor,
                    options: thisOptions
                })
            }
            validProduct.styles = validStyles;
            if (product.shipping.length < 1) {
                return false;
            }
            for (let i = 0; i < product.shipping.length; i++) {
                if (typeof product.shipping[i] == "string") {
                    validProduct.shipping.push(product.shipping[i]);
                }
            }
            for (let i = 0; i < product.images.length; i++) {
                validProduct.images[i] = {
                    url: product.images[i].url,
                    name: product.images[i].name
                }
            }
            if (product.hasOwnProperty("published")) {
                validProduct.published = product.published;
            }
            return validProduct;
        }
        return false;
    } catch (err) {
        return false;
    }
}

/**
 * Validate the product before calling this function
 * 
 * @param {Object} product 
 * @returns {Boolean} Completion
 */
const createNewProduct = async function(product, owner) {
    try {
        let session = driver.session();
        let query = "match (a:Person {name: $owner})-[r:OWNS]-(b:Shop) with b create (b)-[r:STOCKS]->(c:Product { id: $id, name: $name, description: $description, styles: $styles, shipping: $shipping, images: $images, published: $published}) return c"; // Match product by unique product id
        let id = product.id;
        let name = product.name;
        let description = product.description;
        let styles = JSON.stringify(product.styles);
        let shipping = product.shipping;
        let published = product.published;
        let images = JSON.stringify(product.images);
        let params = { id: id, owner: owner, name: name, description: description, styles: styles, shipping: shipping, images: images, published: published };
        return await session.run(query, params)
            .then(async function(result) {
                session.close();
                if (result) {
                    if (result.records) {
                        if (result.records[0]) {
                            return true;
                        }
                    }
                }
                return false;
            })
            .catch((err) => {
                return false;
            })
    } catch (err) {
        return false; // Failed create new product
    }
}

/**
 * Validate product and check for existing before calling this function. Merges existing 
 * 
 * @param {Object} product 
 * @returns {Boolean} Completion
 */
const mergeExistingProduct = async function(product, owner) {
    try {
        let session = driver.session();
        let query = "match (a:Person {name: $owner})-[r:OWNS]-(b:Shop)-[r2:STOCKS]-(c:Product {id: $id}) with c set c = { id: $id, name: $name, description: $description, styles: $styles, shipping: $shipping, images: $images, published: $published} return c";
        let id = product.id;
        let name = product.name;
        let description = product.description;
        let styles = JSON.stringify(product.styles);
        let shipping = product.shipping;
        let published = product.published;
        let images = JSON.stringify(product.images);
        let params = { id: id, owner: owner, name: name, description: description, styles: styles, shipping: shipping, images: images, published: published };
        return await session.run(query, params)
            .then(async function(result) {
                session.close();
                if (result) {
                    if (result.records) {
                        if (result.records[0]) {
                            return true;
                        }
                    }
                }
                return false;
            })
            .catch((err) => {
                console.log(err);
                return false;
            })
    } catch (err) {
        return false;
    }
}

const resolveNewLocalImages = async function(files, newImgData) {
    let i = 0;
    const uploadS3All = files.map(file => {
        return new Promise((resolve, reject) => {
            try {
                resolve(s3Upload.uploadSingle(file, newImgData[i], "minifs-shops-thumbnails", "sh/")); // Will send he file location locally and the name included
            } catch (err) {
                reject(null);
            }
            i++;
        });
    });
    return Promise.all(uploadS3All)
        .then((result) => {
            return result;
        })
};

/**
 * Will save or overwrite a product in the database. If id is missing then it will make new, else merge to existing 
 * 
 * @param {String} owner 
 * @param {String} username 
 * @param {Object} product 
 * @returns {Boolean} Completed or failed
 */
const saveSingleProductToShop = async function(owner, username, product, files, newImgData) {
    try {
        let data;
        let validProduct = validateProduct(product);
        let newImages = await resolveNewLocalImages(files, newImgData);
        newImages = newImages.filter(img => img != false); // Remove any entities that did not process correctly
        validProduct.images = validProduct.images.concat(newImages);
        // Check for existing uuid from random generated
        let id;
        if (!validProduct.id) {
            let common = true;
            let i = 3;
            do { // Will continue to generate a new id until a unique one is create. 
                id = uuidv4().split("-").join(""); // Generate new id
                common = await findProductById(id);
                if (!common) {
                    i = 0;
                    break;
                }
                i--;
            } while (i > 0);
            if (common) {
                return false; // Could not find a unique uuid. This is very very very very very very unlikely. 
            }
        } else {
            id = validProduct.id;
        }
        if (validProduct) {
            if (validProduct.id) { // If product has an id then check db for first. Else just make new
                data = await findProductById(validProduct.id);
                if (data) {
                    return await mergeExistingProduct(validProduct, owner) // Product found with matching id, merge
                } else {
                    return await createNewProduct(validProduct, owner); // Make new product, no product found with id
                }
            } else {
                validProduct.id = id;
                return await createNewProduct(validProduct, owner); // Make new product, no id included
            }
        } else {
            return false;
        }
    } catch (err) {
        console.log(err);
        return false;
    }
}

const filterProductUuidData = (cart) => {
    try {
        if (cart) {
            if (cart.hasOwnProperty("items")) {
                let productIds = cart.items.map((product) => {
                    if (product.hasOwnProperty("uuid")) {
                        return product.uuid;
                    } else {
                        return false;
                    }
                });
                if (productIds) {
                    return productIds;
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
 * Gets a the valid price or lowest matching for a product. If there is no matching price descriptor, then it must be the first or lowest matching price. Products with more than one style and option must have all styles and options named
 * @param {*} stylesArr 
 * @param {*} option 
 * @param {*} style 
 * @returns 
 */
function getPrice(stylesArr, option, style) {
    let lowestMatchingPrice = null;
    for (let i = 0; i < stylesArr.length; i++) {
        for (let j = 0; j < stylesArr[i].options.length; j++) {
            if (lowestMatchingPrice == null || stylesArr[i].options[j].price < lowestMatchingPrice) {
                lowestMatchingPrice = stylesArr[i].options[j].price;
            }
            if (option && style) {
                if (stylesArr[i].descriptor == style && stylesArr[i].options[j].descriptor == option) {
                    return stylesArr[i].options[j].price;
                }
            } else if (option) { // There is only one style and it is not named, but several options
                if (stylesArr[i].options[j].descriptor == option) {
                    return stylesArr[i].options[j].price;
                }
            }
        }
    }
    return lowestMatchingPrice;
}

/**
 * Will get an appropriate image for a product out of all images, matches first valid one and then matches one with matching name to style
 * @param {Object[]} imageArr 
 * @param {String || null} style 
 * @returns {String || null} url
 */
function getImage(imageArr, style) {
    let firstValidImage = -1;
    for (let i = 0; i < imageArr.length; i++) {
        if (imageArr[i].url && firstValidImage == -1) { // Iterate through to find first valid image, return if individual style has no name, style length == 0
            firstValidImage = i;
            if (style.length == 0) {
                return imageArr[firstValidImage].url;
            }
        }
        if (imageArr[i].name.length > 0 && imageArr[i].name == style) { // if match of style name, return matching
            return imageArr[i].url;
        }
    }
    if (firstValidImage > -1) { // if no matches and there is a first valid image, return it
        return imageArr[firstValidImage].url;
    }
    return null;
}

/**
 * Assigns images from queried records in db to associate matches with provided cart items on items and wishlist.
 * Each uuid product for product found is put into a hash with its image array saved as the value for the hash
 * Every time a uuid match is found with images, run setImageAndName to iterate through images and set either name or url depending if you're setting data[i].image url or data[i].style name
 * @param {Object[]} data 
 * @param {Object[]} records 
 * @param {Map} hash 
 * @returns {*}
 */
function assignImagesNamesPrice(data, records, hash) {
    for (let i = 0; i < data.length; i++) {
        if (hash.has(data[i].uuid)) {
            let dataVal = hash.get(data[i].uuid);
            data[i].image = getImage(dataVal.images, data[i].style);
            data[i].name = dataVal.name;
            data[i].price = getPrice(dataVal.styles, data[i].option, data[i].style);
        } else {
            for (let j = 0; j < records.length; j++) {
                if (records[j]._fields) {
                    if (records[j]._fields[0]) {
                        if (records[j]._fields[0].properties) {
                            if (records[j]._fields[0].properties.hasOwnProperty("images") && records[j]._fields[0].properties.hasOwnProperty("name") && records[j]._fields[0].properties.hasOwnProperty("id")) {
                                hash.set(data[i].uuid, {
                                    images: JSON.parse(records[j]._fields[0].properties.images),
                                    name: records[j]._fields[0].properties.name,
                                    styles: JSON.parse(records[j]._fields[0].properties.styles)
                                });
                                if (records[j]._fields[0].properties.id == data[i].uuid) {
                                    data[i].image = getImage(JSON.parse(records[j]._fields[0].properties.images), data[i].style);
                                    data[i].name = records[j]._fields[0].properties.name;
                                    data[i].price = getPrice(JSON.parse(records[j]._fields[0].properties.styles), data[i].option, data[i].style);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return data;
}
/**
 * Should return the following:
 * - Calculated shipping data on a per shop basis
 * - Valid shipping classes that the user may choose from to change shipping
 * - Calculated product prices
 * - Checkout total
 * - If a product in cart has an invalid product, quantity < 1 or does not have shipping class that ships to customer, prevent data return, just return product that needs to be removed from cart
 * Will be used for determining cart values for user and previous to financial payment to Stripe so data must be secure and valid
 * 
 *  @param {Object[]} cart
 *  @param {Object[]} records
 *  @param {Map} hash
 *  @returns {*}
 */
const getAllPreCheckoutData = async(cart, records, hash) => {
    // SHOP HASH Get each distinct shop by uuid and associate properties of shop as object and references to products as array key
    // { shopName: String, shopOwner: String, products: [...uuid]}
    let shopHash = new Map();
    // PER PRODUCT SHIPPING for each shop, go through each product once and get ALL perProduct calculated shipping prices 
    // ONLY ONCE IF SHIP TOTAL 0 after that, iterate again if price == 0 and get LOWEST onlyOnce shipping price and apply that ONCE for entire shop
    // FAIL FOR NO MATCHING SHIP CLASS DURING LOOKUP If no matching shipping class for customer country, fail, return product with no matching shipping class alert

    // PRODUCT PRICES individual product prices
    // SHIPPING TOTAL PER SHOP Store shipping total on a per shop basis
    // TOTAL CHECKOUT $ Store checkout total for entire cart

    // OTHER ALLOWED SHIPPING CLASSES Include other allowed shipping classes TO users country PER product so user can change shipping class on product
    // GOOD CC? Check users CC
    // GOOD PRODUCT QUANTITY? Product stock must be greater or equal to amount user is buying
    // Stripe check outside of this function

}


/**
 * Filter uuids from list of products and then get all relevant data to display to user for checkout of a product. This is not valid data as this will be sent to the client for the user to look at. Never use this data to perform checkouts. Only to display info to the user. The server is only interested in validating data as it exists on the server before financial transactions.
 * @param {*} cart 
 * @returns 
 */
const getImagesAndTitlesForCartProductsDb = async(cart) => {
    try {
        let productIds = await filterProductUuidData(cart);
        if (productIds) {
            // $productIds should look exactly like ["1212", "23123123", "1231312"]. See https://stackoverflow.com/questions/61121568/neo4j-match-on-lists
            let session = driver.session();
            let query = "match (a:Product) where a.id in $productIds return a"; // Should get all products with matching ids in organized string array
            let params = { productIds: productIds };
            return await session.run(query, params)
                .then((result) => {
                    let hash = new Map();
                    if (result) {
                        if (result.records) {
                            if (result.records[0]) {
                                cart.items.sort(function(a, b) { // Organize products logically by order of same shop ids
                                    return a.shopId.localeCompare(b.shopId);
                                });
                                cart.items = assignImagesNamesPrice(cart.items, result.records, hash);
                                cart.wishList = assignImagesNamesPrice(cart.wishList, result.records, hash);
                                cart.dataRemoved = false; // Advise which product found FIRST with no valid matching shipping class, if false all products good. When logged in app will usually prevent user from adding products to cart without a valid shipping class
                                cart.itemCartTotal = {
                                    products: [],
                                    shipping: null
                                }; // Prepare item total with selected shipping classes
                                return cart;
                            }
                        }
                    }
                    return {
                        error: "Failed to get product data"
                    }
                })
                .catch((err) => {
                    console.log(err);
                    return {
                        error: "Failed to get product data"
                    }
                })
        } else {
            return {
                error: "Failed to get product data"
            }
        }
    } catch (err) {
        return {
            error: "Failed to get product data"
        }
    }
}

module.exports = {
    getShopDbProducts: getShopDbProducts,
    saveSingleProductToShop: saveSingleProductToShop,
    getSingleProductById: getSingleProductById,
    getImagesAndTitlesForCartProductsDb: getImagesAndTitlesForCartProductsDb
}