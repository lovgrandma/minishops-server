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
const users = require('./users.js');
const ecommerce = require('./ecommerce.js');

/**
 * Retrieves products paginated from the database
 * 
 * @param {String} owner - The owner of the shop that you want to get from
 * @param {string} filter - The order that products are filtered through 
 * @param {number} append - pagination
 */
const getShopDbProducts = async function(owner, filter = null, append = 0, noAppend = false) {
    try {
        append += 10;
        let session = driver.session();
        let query = "match (a:Person { name: $owner })-[r:OWNS]-(b:Shop)-[r2:STOCKS]-(c:Product) return c";
        if (!noAppend) {
            query += " limit $append"; // Append if no append is false
        }
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
                return false;
            })
    } catch (err) {
        return false;
    }
}

const resolveNewLocalImages = async function(files, newImgData) {
    let i = 0;
    const uploadS3All = files.map(file => {
        console.log(file);
        return new Promise((resolve, reject) => {
            try {
                resolve(s3Upload.uploadSingle(file, newImgData[i], "minifs-shops-thumbnails", "sh/", true)); // Will send he file location locally and the name included
            } catch (err) {
                reject(null);
            }
            i++;
        });
    });
    return await Promise.all(uploadS3All)
        .then((result) => {
             return result;
        });
};

/**
 * Will delete all images user marked for deletion.
 * NOTE: Sometimes isn't updating for some reason. Some browser sessions load product without deleted images some erroneously still have images erroneously there. 
 * Final query will show record as updated but on database images on product dont show as deleted. Very strange caching error
 * @param {Object} product 
 * @param {Array} deletions 
 * @returns 
 */
const resolveProductImgDeletions = async function(productData, deletions) {
    try {
        if (deletions) {
            try {
                if (JSON.parse(deletions)) {
                    deletions = JSON.parse(deletions);
                }
            } catch (err) {
                // Fail silently, didn't need to parse deletions
            }
            const deleteAllFromS3 = deletions.map(file => {
                return new Promise((resolve, reject) => {
                    try {
                        resolve(s3Upload.deleteSingle(file, "minifs-shops-thumbnails"));
                    } catch (err) {
                        reject(null);
                    }
                });
            });
            let deleted = await Promise.all(deleteAllFromS3)
                .then((result) => {
                    return result;
                });
            deleted = deleted.filter((a) => a ? a : null);
            let session = driver.session();
            let query = "match (a:Product { id: $id }) return a";
            let params = { id: productData.id };
            return await session.run(query, params)
                .then( async (result) => {
                    session.close();
                    if (result.records[0]._fields[0].properties) {
                        let tempImg = Array.from(JSON.parse(result.records[0]._fields[0].properties.images));
                        let deletedRecords = [];
                        for (let i = 0; i < tempImg.length; i++) {
                            if (deleted.indexOf(tempImg[i].url) > -1) {
                                let tempDeleted = tempImg.splice(i, 1);
                                deletedRecords.push(tempDeleted[0].url);
                                i--;
                            }
                        }
                        const newImgData = JSON.stringify(tempImg);
                        query = "match (a:Product { id: $id }) set a.images = $images return a";
                        params.images = newImgData;
                        let session2 = driver.session();
                        let data = await session2.run(query, params)
                            .then((result) => {
                                session2.close();
                                return deletedRecords;
                            })
                            .catch((err) => {
                                return [];
                            })
                        return data;
                    }
                })
                .catch((err) => {
                    return [];
                })
        } else {
            return [];
        }
    } catch (err) {
        return [];
    }
}

/**
 * Will save or overwrite a product in the database. If id is missing then it will make new, else merge to existing 
 * 
 * @param {String} owner 
 * @param {String} username 
 * @param {Object} product 
 * @returns {Boolean} Completed or failed
 */
const saveSingleProductToShop = async function(owner, username, productData, files, newImgData, deletions) {
    try {
        let data;
        let validProduct = validateProduct(productData);
        let newImages = await resolveNewLocalImages(files, newImgData);
        console.log(newImages);
        newImages = newImages.filter(img => img != false); // Remove any entities that did not process correctly
        validProduct.images = validProduct.images.concat(newImages);
        let deletedImages = await resolveProductImgDeletions(productData, deletions);
        // This will remove the deleted images from the array of images to be published on the image update
        try {
            if (deletedImages) {
                for (i = 0; i < validProduct.images.length; i++) {
                    if (deletedImages.indexOf(validProduct.images[i].url) > -1) {
                        validProduct.images.splice(i, 1);
                    }
                }
            }
        } catch (err) {
            // No deleted images
        }
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
                                if (!hash.get(data[i].uuid)) { // This is important. Removing this will cause hash data to be overwritten unecessarily and bad name, image and price data to be set on some products
                                    hash.set(records[j]._fields[0].properties.id, { // Match by same record
                                        images: JSON.parse(records[j]._fields[0].properties.images),
                                        name: records[j]._fields[0].properties.name,
                                        styles: JSON.parse(records[j]._fields[0].properties.styles)
                                    });
                                }
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
 * Takes list of shop ids and gets shops by using getShopsByList function
 * @param {Object[]} cart 
 * @returns {Object[] || Boolean}
 */
async function getShops(shopIds) {
    let shopData = await getShopsByList(shopIds);
    if (!shopData || shopData.length == 0) {
        return false;
    }
    return shopData;
}

/**
 * Will take an array of shop ids and return all shop records from db
 * @param {String[]} shop strings
 * @returns {Object[]} shops
 */
const getShopsByList = async(shops) => {
    try {
        let session = driver.session();
        let query = "match (a:Shop) where a.id in $shops return a";
        let params = { shops: shops };
        return await session.run(query, params)
            .then((result) => {
                let shopData = [];
                if (result) {
                    if (result.records) {
                        for (let i = 0; i < result.records.length; i++) {
                            if (result.records[i]) {
                                if (result.records[i]._fields) {
                                    if (result.records[i]._fields[0]) {
                                        if (result.records[i]._fields[0].properties) {
                                            try {
                                                result.records[i]._fields[0].properties.shippingClasses = JSON.parse(result.records[i]._fields[0].properties.shippingClasses);
                                            } catch (err) {
                                                result.records[i]._fields[0].properties.shippingClasses = [];
                                            }
                                            shopData.push(result.records[i]._fields[0].properties);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                return shopData;
            })
            .catch((err) => {
                return false;
            });
    } catch (err) {
        return false;
    }
}

/**
 * Should return the following:
 * - PER PRODUCT SHIPPING TOTAL $, PER SHOP SHIPPING TOTAL $ Calculated shipping data on a per shop basis
 * - OTHER VALID SHIPPING CLASSES TO USER Valid shipping classes that the user may choose from to change shipping, for SHIPPING SELECT DROPDOWN
 * - PER PRODUCT TOTAL $, TOTAL PER SHOP TOTAL $ Calculated product prices
 * - TOTAL CHECKOUT $ Checkout total
 * - If a product in cart does not have shipping class that ships to customer, prevent data return, just return product that needs to be removed from cart
 * Will be used for determining cart values for user and previous to financial payment to Stripe so data must be secure and valid
 * Only append ONLY ONCE shipping prices if shipping total per shop still at zero after first iteration
 * If shipping changed, will advise user with changedShippingOnAtleastOne variable
 * 
 *  @param {Object[]} cart
 *  @param {Object[]} records
 *  @param {Map} hash
 *  @returns {Object[] || Boolean} Array of objects or falsy result
 */
const getAllPreCheckoutData = async(cart, records, username) => {
    try {
        if (username) {
            let userShipping = await users.getUserShippingDataFromDb(username);
            if (userShipping.hasOwnProperty("country")) {
                let changedShippingOnAtleastOne = false;
                // SHOP HASH Get each distinct shop by uuid and associate properties of shop as object and references to products as array key
                // { shopName: String, shopOwner: String, products: [...uuid]}
                let shopHash = new Map();
                let shopIds = [];
                for (let i = 0; i < cart.length; i++) {
                    if (cart[i].hasOwnProperty("shopId")) {
                        if (shopIds.indexOf(cart[i].shopId) < 0) {
                            shopIds.push(cart[i].shopId);
                        }
                    }
                }
                let shopData = await getShops(shopIds);
                // This will populate the shopHash with appropriate shopData for fast lookup
                for (let i = 0; i < shopData.length; i++) {
                    shopHash.set(shopData[i].id, shopData[i]);
                }
                // Will determine how much shipping per product, product totals, total shipping and total product costs per shop and if a shipping class was changed or not
                function determinePerProductShipping(cart, shopHash, country) {
                    // Will find all valid shipping classes for product
                    function AllValidShippingClasses(product, shopHash, country) {
                        let validShippingClassData = {
                            country: country, // country that user is receiving product at
                            classes: [] // supported shipping classes on product to user country
                        }
                        if (product.hasOwnProperty("shopId")) {
                            if (shopHash.has(product.shopId)) { // match shop and look for good shipping class
                                let tempShop = shopHash.get(product.shopId);
                                for (let i = 0; i < tempShop.shippingClasses.length; i++) {
                                    if (tempShop.shippingClasses[i].selectedCountries.indexOf(country) > -1) { // Ships to user country
                                        if (product.shipping.indexOf(tempShop.shippingClasses[i].uuid) > -1) { // Shipping supported on product
                                            validShippingClassData.classes.push(tempShop.shippingClasses[i]);
                                        }
                                    }
                                }
                            }
                        }
                        return validShippingClassData;
                    }
                    // Will see if the current selected shipping class is valid, if not gets first valid one. If no match will be null
                    function determineCurrentShippingValidOrAssignNew(cart) {
                        for (let i = 0; i < cart.length; i++) {
                            if (cart[i].hasOwnProperty("shippingClass")) {
                                if (cart[i].shippingClass.hasOwnProperty("shippingRule")) {
                                    let cachedShippingRule = cart[i].shippingClass.shippingRule;
                                    cart[i].shippingClass.shippingRule = null; // Make this null, we need to reverify the shipping classes validity
                                    for (let j = 0; j < cart[i].validShippingClassesForUser.classes.length; j++) {
                                        if (cachedShippingRule == cart[i].validShippingClassesForUser.classes[j].shippingRule) { // match found good shipping class
                                            cart[i].shippingClass = {
                                                shippingRule: cart[i].validShippingClassesForUser.classes[j].shippingRule,
                                                perProduct: cart[i].validShippingClassesForUser.classes[j].perProduct,
                                                price: cart[i].validShippingClassesForUser.classes[j].shippingPrice
                                            };
                                        }
                                    }
                                }
                            }
                        }
                        // Assign new shipping class since the old once was invalid, did not find valid shipping rule matching users input one
                        for (let i = 0; i < cart.length; i++) {
                            if (!cart[i].shippingClass.shippingRule) { // product has no shipping class rule which it shouldnt
                                if (!changedShippingOnAtleastOne) {
                                    changedShippingOnAtleastOne = true;
                                }
                                if (cart[i].validShippingClassesForUser.classes[0]) {
                                    cart[i].shippingClass = {
                                        shippingRule: cart[i].validShippingClassesForUser.classes[0].shippingRule,
                                        perProduct: cart[i].validShippingClassesForUser.classes[0].perProduct,
                                        price: cart[i].validShippingClassesForUser.classes[0].shippingPrice
                                    }
                                }
                            }
                        }
                        return cart;
                    }
                    for (let i = 0; i < cart.length; i++) {
                        cart[i].validShippingClassesForUser = AllValidShippingClasses(cart[i], shopHash, country); // Gets all valid shipping classes per product
                    }
                    cart = determineCurrentShippingValidOrAssignNew(cart); // Assigns a shipping class if the current selected one is invalid
                    // Will determine totals for shipping and cart products per product and per shop, including onlyOnce rules if no perproduct shipping
                    shopHash.forEach((value, key) => {
                        // first check to add all perProduct shipping classes
                        let temp = shopHash.get(key);
                        temp.totals = {
                            totalShipping: 0,
                            totalProductCosts: 0
                        }
                        // Calculate the shipping for all shipping classes calculated on a per product basis
                        for (let i = 0; i < cart.length; i++) {
                            if (cart[i].hasOwnProperty("shopId")) {
                                if (cart[i].hasOwnProperty("shippingClass") && cart[i].shopId == key) {
                                    if (cart[i].shippingClass.perProduct) {
                                        temp.totals.totalShipping = temp.totals.totalShipping + (cart[i].shippingClass.price * cart[i].quantity);
                                    }
                                }
                            }
                        }
                        let shippingApplied = false;
                        // Should retrieve lowest shipping for only once application of shipping and only apply if shippingApplied == false
                        function getLowestShippingIfNotApplied() {
                            if (!shippingApplied) {
                                let lowest = -1;
                                for (let i = 0; i < cart.length; i++) {
                                    if (temp.id == cart[i].shopId) {
                                        if (lowest == -1 || cart[i].shippingClass.price < lowest) {
                                            lowest = parseFloat(cart[i].shippingClass.price);
                                        }
                                    }
                                }
                                shippingApplied = true;
                                return lowest;
                            } else {
                                return 0;
                            }
                        }
                        // // second check to add 1 (cheapest) onlyOnce shipping class, if shipping value is at 0
                        let cheapest = 0;
                        for (let i = 0; i < cart.length; i++) {
                            if (cart[i].hasOwnProperty("shopId")) {
                                if (cart[i].hasOwnProperty("shippingClass") && cart[i].shopId == key) {
                                    temp.totals.totalProductCosts = temp.totals.totalProductCosts + (cart[i].price * cart[i].quantity);
                                    cart[i].calculatedShipping = cart[i].shippingClass.perProduct ?
                                        cart[i].shippingClass.price * cart[i].quantity
                                        : getLowestShippingIfNotApplied();
                                    cart[i].calculatedTotal = cart[i].price * cart[i].quantity; // DO NOT PUT .toFixed(2) here. Will cause failed payments
                                    if (!cart[i].shippingClass.perProduct) {
                                        if (temp.totals.totalShipping == 0) {
                                            if (cheapest == 0 && cart[i].shippingClass.price > 0 || cart[i].shippingClass.price < cheapest) {
                                                cheapest = cart[i].shippingClass.price;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        // If no perProduct shipping and all onlyOnce, total shipping should be 0 and we will only count the onlyOnce shipping on the total
                        if (temp.totals.totalShipping == 0) {
                            temp.totals.totalShipping = cheapest;
                        }
                        temp.totals.totalShipping = parseFloat(temp.totals.totalShipping).toFixed(2);
                        temp.totals.totalProductCosts = parseFloat(temp.totals.totalProductCosts).toFixed(2);
                         shopHash.set(key, temp);
                    });
                    return cart, shopHash;
                }
                cart, shopHash = determinePerProductShipping(cart, shopHash, userShipping.country);
                let shopArr = [];
                let totals = {
                    shipping: 0,
                    products: 0,
                    total: 0
                }
                shopHash.forEach((value, key) => {
                    let temp = shopHash.get(key);
                    totals.shipping = totals.shipping + parseFloat(temp.totals.totalShipping);
                    totals.products = totals.products + parseFloat(temp.totals.totalProductCosts);
                    shopArr.push(temp);
                });
                totals.total = totals.shipping + totals.products;
                totals.shipping = parseFloat(totals.shipping).toFixed(2);
                totals.products = parseFloat(totals.products).toFixed(2);
                totals.total = parseFloat(totals.total).toFixed(2);
                return {
                    cart: cart,
                    shop: shopArr,
                    totals: totals,
                    changedShippingOnAtleastOne: changedShippingOnAtleastOne
                }
            }
        }
        return false;
    } catch (err) {
        return false;
    }
}

/**
 * Filter uuids from list of products and then get all relevant data to display to user for checkout of a product. This is not valid data as this will be sent to the client for the user to look at. Never use this data to perform checkouts. Only to display info to the user. The server is only interested in validating data as it exists on the server before financial transactions.
 * @param {*} cart 
 * @returns 
 */
const getImagesAndTitlesForCartProductsDb = async(cart, username, getNewCart = false) => {
    try {
         const getRelevantCart = async (cart, getNewCart, username) => {
            if (getNewCart || !cart) {
                return await ecommerce.getCart(username);
            } else {
                return cart;
            }
        }
        return getRelevantCart(cart, getNewCart, username)
            .then(async (cart) => {
                let productIds = await filterProductUuidData(cart);
                if (productIds) {
                    // $productIds should look exactly like ["1212", "23123123", "1231312"]. See https://stackoverflow.com/questions/61121568/neo4j-match-on-lists
                    let session = driver.session();
                    let query = "match (a:Product) where a.id in $productIds return a"; // Should get all products with matching ids in organized string array
                    let params = { productIds: productIds };
                    return await session.run(query, params)
                        .then( async (result) => {
                            let hash = new Map();
                            if (result) {
                                if (result.records) {
                                    if (result.records[0]) {
                                        cart.items.sort(function(a, b) { // Organize products logically by order of same shop ids
                                            return a.shopId.localeCompare(b.shopId);
                                        });
                                        cart.items.forEach((item, index) => { // Add supported shipping on each product, to filter what shipping classes can be used on each
                                            for (let i = 0; i < result.records.length; i++) {
                                                if (item.uuid == result.records[i]._fields[0].properties.id) {
                                                    cart.items[index].shipping = result.records[i]._fields[0].properties.shipping;
                                                }
                                            }
                                        });
                                         cart.items = assignImagesNamesPrice(cart.items, result.records, hash);
                                        if (cart.wishList) {
                                            cart.wishList = assignImagesNamesPrice(cart.wishList, result.records, hash);
                                        }
                                        cart.checkoutTruths = await getAllPreCheckoutData(cart.items, result.records, username); // if false, get preCheckout failed, dont provide pre checkout shipping/total data
                                        return cart;
                                    } else {
                                        // No products matched because the cart is empty
                                        cart.checkoutTruths = {};
                                        return cart;
                                    }
                                }
                            }
                            return {
                                error: "Failed to get product data"
                            }
                        })
                        .catch((err) => {
                            return {
                                error: "Failed to get product data"
                            }
                        })
                } else {
                    return {
                        error: "Failed to get product data"
                    }
                }
            });
    } catch (err) {
        return {
            error: "Failed to get product data"
        }
    }
}

const changeShippingClass = async(username, productData, newShippingRule) => {
    try {
        if (productData.uuid) {
            let session = driver.session();
            let query = "match (a:Product { id: $id })-[r:STOCKS]-(b:Shop) return a, b";
            let params = { id: productData.uuid };
            return await session.run(query, params)
                .then( async (result) => {
                    session.close();
                    let validatedClasses = JSON.parse(result.records[0]._fields[1].properties.shippingClasses);
                    let supportedOnProduct = result.records[0]._fields[0].properties.shipping;
                    let userShipping = await users.getUserShippingDataFromDb(username);
                    if (userShipping.country) {
                        let shippingToSet = null;
                        for (let i = 0; i < validatedClasses.length; i++) {
                            if (newShippingRule == validatedClasses[i].shippingRule && supportedOnProduct.indexOf(validatedClasses[i].uuid) > -1 && validatedClasses[i].selectedCountries.indexOf(userShipping.country) > -1) { // Found new shipping rule in valid shop shipping classes, specific product supports new selected shipping class and user country is supported
                                shippingToSet = {
                                    shippingRule: validatedClasses[i].shippingRule,
                                    perProduct: validatedClasses[i].perProduct
                                }
                            }
                        }
                        if (shippingToSet) {
                            let session2 = driver.session();
                            query = "match (a:Person { name: $username }) return a";
                            params = { username: username };
                            return await session2.run(query, params)
                                .then( async (result) => {
                                    session2.close();
                                    let cart = JSON.parse(result.records[0]._fields[0].properties.cart);
                                    for (let i = 0; i < cart.items.length; i++) {
                                        if (cart.items[i].uuid == productData.uuid && cart.items[i].style == productData.style && cart.items[i].option == productData.option) {
                                            cart.items[i].shippingClass = shippingToSet;
                                            break;
                                        }
                                    }
                                    cart = JSON.stringify(cart);
                                    let session3 = driver.session();
                                    query = "match (a:Person { name: $username }) set a.cart = $cart return a";
                                    params = { username: username, cart: cart };
                                    return await session3.run(query, params)
                                        .then((result) => {
                                            session3.close();
                                            return {
                                                data: JSON.parse(result.records[0]._fields[0].properties.cart),
                                                error: "",
                                                success: true
                                            }
                                        })
                                        .catch(() => {
                                            return {
                                                data: null,
                                                error: "failed to update shipping class",
                                                success: false
                                            }
                                        })
                                })
                                .catch((err) => {
                                    return {
                                        data: null,
                                        error: "failed to update shipping class",
                                        success: false
                                    }
                                })
                        } else {
                            return {
                                data: null,
                                error: "failed to update shipping class",
                                success: false
                            }
                        }
                    } else {
                        return {
                            data: null,
                            error: "failed to update shipping class",
                            success: false
                        }
                    }
                })
                .catch((err) => {
                    return {
                        data: null,
                        error: "failed to update shipping class",
                        success: false
                    }
                });
        } else {
            return {
                data: null,
                error: "failed to update shipping class",
                success: false
            }
        }
    } catch (err) {
        return {
            data: null,
            error: "failed to update shipping class",
            success: false
        }
    }
}


/**
 * Later on we can use "Auth" for other authorized users able to edit the shop
 * @param {*} owner 
 * @param {*} id 
 * @param {*} auth 
 * @returns 
 */
const archiveSingleProduct = async function(owner, productId, auth) {
    try {
        let session = driver.session();
        let query = "match (a:Person { name: $username})-[r:OWNS]-(b:Shop)-[r2:STOCKS]-(c:Product { id: $productId}) return c";
        let params = { username: owner, productId: productId };
        return await session.run(query, params)
            .then(async (result) => {
                session.close();
                if (result.records[0]._fields[0].properties.images) {
                    let im = JSON.parse(result.records[0]._fields[0].properties.images);
                    let promises = im.map(img => {
                        return new Promise((resolve, reject) => {
                            try {
                                resolve(s3Upload.deleteSingle(img.url, "minifs-shops-thumbnails"));
                            } catch (err) {
                                console.log(err);
                                reject(false);
                            }
                        });
                    });
                    let dat = await Promise.all(promises);
                    let session2 = driver.session();
                    query = "match (a:Product { id: $productId }) set a:aProduct remove a:Product return a";
                    session2.run(query, params)
                        .then((result) => {
                            return true;
                        })
                        .catch((err) => {
                            console.log(err);
                            return false;
                        })
                }
                // do promise, iterate through images, delete all.
                // Then do another query, turn to archive
            })
            .catch((err) => {
                console.log(err);
                return false;
            })
    } catch (err) {
        console.log(err);
        return false;
    }
}

module.exports = {
    getShopDbProducts: getShopDbProducts,
    saveSingleProductToShop: saveSingleProductToShop,
    getImagesAndTitlesForCartProductsDb: getImagesAndTitlesForCartProductsDb,
    changeShippingClass: changeShippingClass,
    archiveSingleProduct: archiveSingleProduct
}