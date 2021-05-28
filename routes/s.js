/**
 * Main routes file for shops s.js
 * @version 0.0.1
 * @author jesse Thompson
 * 
 * Routes calls for shop functionality
 */

const router = require('express').Router();
const path = require('path');
const uuidv4 = require('uuid/v4');
const multer = require('multer');
const product = require('./api/product.js');
const shippingClasses = require('./api/shippingclasses.js');
const users = require('./api/users.js');
const ecommerce = require('./api/ecommerce.js');
const products = require('./api/products.js');
const cc = require('./api/cc.js');
const bookKeeping = require('./api/bookkeeping.js');
const cart = require('./api/cart.js');
const orders = require('./api/orders.js');

const uploadSpace = multer({
    storage: multer.diskStorage({
        destination: './temp/',
        filename: function(req, file, cb) {
            cb( null, uuidv4().split("-").join("") + resolveName(file));
        }
    })
});

/**
 * Will resolve ending file name to ensure no error
 * 
 * @param {{File}} file 
 * @returns 
 */
const resolveName = function(file) {
    if (file) {
        if (file.originalname) {
            if (file.originalname.match(/.([a-zA-Z0-9]*)$/)) {
                if (file.originalname.match(/.([a-zA-Z0-9]*)$/)[1]) {
                    return  "." + file.originalname.match(/.([a-zA-Z0-9]*)$/)[1];
                }
            }
        }
    }
    return "";
}

const getShopProducts = async(req, res, next) => {
    let productsData = [];
    if (req.body) {
        if (req.body.owner) {
            let filter = null;
            let append = 0;
            if (req.body.filter) {
                filter = req.body.filter;
            }
            if (req.body.append) {
                append = req.body.append;
            }
            productsData = await products.getShopDbProducts(req.body.owner, filter, append);
        }
    }
    return res.json({ querystatus: "200", products: productsData });
}

/**
 * Will determine if necessary data has been sent before update shipping class in shop db
 * 
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 * @returns {response} json
 */
const saveShippingClass = async(req, res, next) => {
    if (req.body) {
        // If a hacker doesn't include self and sneaks past the middleware hash check, it doesn't matter because this will fail without req.body.self
        if (req.body.self && req.body.owner && req.body.username && req.body.hash && req.body.goodData) {
            let uuid = null;
            if (req.body.uuid) { // If a uuid exists, we are probably updating (Probably meaning if we dont find a uuid match, we treat it as new)
                uuid = req.body.uuid;
            }
            let data = await shippingClasses.saveOneShippingClassToShop(req.body.owner, req.body.username, req.body.goodData, uuid);
            if (data) {
                return res.json({ data: data });
            } else {
                return res.json({ error: "Shipping class update failed", action: null });
            }
        } else {
            return res.json({ error: "Shipping class update failed", action: null });
        }
    } else {
        return res.json({ error: "Shipping class update failed", action: null });
    }
};

// Untested
const getShippingClasses = async(req, res, next) => {
    if (req.body) {
        if (req.body.owner) {
            let data = await shippingClasses.getShippingClassesOfShop(req.body.owner);
            return res.json({ data: data });
        } else {
            return res.json({ error: "Get shipping classes failed", action: null });
        }
    } else {
        return res.json({ error: "Get shipping classes failed", action: null });
    }
}

const saveSingleProduct = async(req, res, next) => {
    try {
        let files = null;
        if (req.files) { // Resolve files if files incoming
            files = req.files;
        }
        let imgNames = [];
        try {
            if (req.body.imgNames) {
                imgNames = JSON.parse(req.body.imgNames);
            }
        } catch (err) {
            imgNames = [];
        }
        if (req.body) {
            if (req.body.self && req.body.owner && req.body.username && req.body.hash && req.body.product) {
                let data = await products.saveSingleProductToShop(req.body.owner, req.body.username, JSON.parse(req.body.product), files, imgNames);
                return res.json({ data: data });
            } else {
                return res.json({ error: "Save single product failed", action: null });
            }
        } else {
            return res.json({ error: "Save single product failed", action: null });
        }
    } catch (err) {
        return res.json({ error: "Save single product failed", action: null });
    }
}

/**
 * Main get product for single product page endpoint
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 * @returns {json}
 */
const getSingleProduct = async(req, res, next) => {
    try {
        if (req.body.productId) {
            let recommended = false;
            let append = 0;
            if (req.body.recommended) {
                recommended = true;
            }
            if (req.body.append) { // Will always be equal to the current amount of recommendations the user has on page. Function getSingleProductById always adds 20 more videos
                append = req.body.append;
            }
            let data = await product.getSingleProductById(req.body.productId, recommended, append);
            if (data) {
                return res.json({ data: data });
            } else {
                return res.json({ error: "Get single product failed", action: null });
            }
        } else {
            return res.json({ error: "Get single product failed", action: null });
        }
    } catch (err) {
        return res.json({ error: "Get single product failed", action: null });
    }
}

const saveShippingDataOnUser = async(req, res, next) => {
    try {
        if (req.body.self && req.body.shippingData && req.body.username) {
            let data = await users.saveShippingDataToUserRecord(req.body.username, req.body.shippingData);
            if (data) {
                return res.json({ querystatus: "Shipping successfully updated", data: data });
            } else {
                return res.json({ error: "Failed to update shipping data"});
            }
        } else {
            return res.json({ error: "Failed to update shipping data"});
        }
    } catch (err) {
        return res.json({ error: "Failed to update shipping data"});
    }
}

const fetchUserShippingData = async(req, res, next) => {
    try {
        if (req.body.self && req.body.username) {
            let data = await users.getUserShippingDataFromDb(req.body.username);
            if (data) {
                return res.json({ data: data });
            } else {
                return res.json({ error: "Failed to get shipping data"});
            }
        } else {
            return res.json({ error: "Failed to get shipping data"});
        }
    } catch (err) {
        return res.json({ error: "Failed to get shipping data"});
    }
}

const addOneProductToCart = async(req, res, next) => {
    try {
        if (req.body.self && req.body.username && req.body.product) {
            let data = await users.addOneProductToUserCartDb(req.body.username, req.body.product);
            if (data) {
                if (data.error) {
                    return res.json({ data: data, error: data.error });
                } else {
                    return res.json({ data: data });
                }
            } else {
                return res.json({ data: {}, error: "Failed to add product to cart" });
            }
        } else {
            return res.json({ error: "Failed to add product to cart" });
        }
    } catch (err) {
        return res.json({ error: "Failed to add product to cart" });
    }
}

const getImagesAndTitlesForCartProducts = async(req, res, next) => {
    try {
        if (req.body.hasOwnProperty("cachedCart")) {
            let username = "";
            if (req.body.username) {
                username = req.body.username;
            }
            let checkCC = false;
            if (req.body.checkCC) {
                checkCC = req.body.checkCC;
            }
            let getNewCart = false;
            if (req.body.getNewCart) {
                getNewCart = req.body.getNewCart;
            }
            let cachedCart = null;
            if (req.body.cachedCart) {
                cachedCart = req.body.cachedCart;
            }
            let data = await products.getImagesAndTitlesForCartProductsDb(cachedCart, username, getNewCart);
            if (data.error) {
                return res.json({ data: null, error: data.error });
            } else {
                return res.json({ data: data });
            }
        }
    } catch (err) {
        return res.json({ error: "Failed to get product data" });
    }
}

// Checks truths totals on each property to check for equality. If not equality total was changed.
function detectCheckoutTruthsMisMatch(newTotals, oldTotals) {
    for (const [key, value] of Object.entries(oldTotals)) {
        if (value != newTotals[key]) {
            return false;
        }
    }
    return true;
}

const processCompleteCheckout = async(req, res, next) => {
    try {
        if (req.body.username) {
            let data = await products.getImagesAndTitlesForCartProductsDb(req.body.cachedCart, req.body.username, true); // Always get new cart
            if (!data) {
                return res.json({ cartData: null, error: "Failed to complete checkout. Your account was not charged" });
            } else if (data.error) {
                return res.json({ cartData: null, error: data.error });
            } else {
                // Get good Stripe CC data on user acc , will check their mongoDB. Does not credit card check due to Stripe CC policy (Excessive to check CC's for validity. CC's are checked for accurate data when added to Stripe's db)
                let userStripeData = await cc.getUserStripeAccData(req.body.username);
                if (!userStripeData) {
                    // No user stripe account
                    return res.json({ cartData: data, error: "There's a problem with your record. Please contact Minipost administration" });
                }
                let userCCsData = await cc.getAccountCCs(userStripeData); // User credit cards in list
                if (!cc.validateAccountCCsData(userCCsData)) {
                    return res.json({ cartData: data, error: "You'll need to add a valid Credit Card to your account to make purchases" });
                }                
                // Retrieve shop account and check valid receiving Stripe account for shop
                if (data.hasOwnProperty('checkoutTruths')) {
                    if (data.checkoutTruths.hasOwnProperty('shop')) {
                        let resolveShopPaymentAccounts = data.checkoutTruths.shop.map(shop => {
                            return new Promise(async (resolve, reject) => {
                                try {
                                    let shopCC = await cc.getShopStripeData(shop.id);
                                    if (shopCC) {
                                        shop.CC = shopCC;
                                        resolve(shop);
                                    } else {
                                        reject(false);
                                    }
                                } catch (err) {
                                    reject(false);
                                }
                            });
                        });
                        data.checkoutTruths.shop = await Promise.all(resolveShopPaymentAccounts);
                    }
                }
                let badShopCCData = [];
                for (let i = 0; i < data.checkoutTruths.shop.length; i++) {
                    if (data.checkoutTruths.shop[i].hasOwnProperty('CC')) {
                        if (!data.checkoutTruths.shop[i].CC.username || !data.checkoutTruths.shop[i].CC.shopAcc) {
                            badShopCCData.push(data.checkoutTruths.shop[i]);
                        } 
                    } else {
                        badShopCCData.push(data.checkoutTruths.shop[i]);
                    }
                }
                if (badShopCCData.length != 0) { // Bad shops must be equal to zero, or else there is a shop selling product without a customer Stripe acc attached
                    return res.json({ cartData: data, error: "A shop was missing valid banking data. Your account was not charged", missingShopCC: badShopCCData });
                } else {
                    // Check good product quantity on ALL products
                    let finalCheckoutCart = await ecommerce.resolveCartQuantities(data, req.body.username); // Final checkout cart will contain mutated cart with changedQuantity (Bool) and newQuantity (Num) properties
                    if (!finalCheckoutCart) { // Bad error, something went wrong when adjusting cart quantities
                        let newCartData = await products.getImagesAndTitlesForCartProductsDb(finalCheckoutCart, req.body.username, true);
                        return res.json({ cartData: newCartData, error: "The purchase was not completed. Your account was not charged" });
                    } else {
                        // Go through each new product data, if any have changedQuantity == true, product quantity was adjusted do not fulfill
                        for (let i = 0; i < finalCheckoutCart.length; i++) {
                            if (finalCheckoutCart[i].changedQuantity) {
                                return res.json({ cartData: data, error: "We had to adjust some quantities in your cart due to availability changes, please review. Your account was not charged" });
                            }
                        }
                        // This will filter out erroneous calls from the front end. If there is a mismatch in checkout total calculated and checkout total provided from front end, its an error or a hacker. Don't charge order
                        let checkoutTotalMismatch = detectCheckoutTruthsMisMatch(data.checkoutTruths.totals, req.body.checkoutTruths.totals);
                        if (!checkoutTotalMismatch) {
                            return res.json({ cartData: null, error: "The total you were quoted and the total we calculated did not match. Your account was not charged" });
                        }
                        // If the data quantity was not manipulated due to lack of stock, the purchase can be fulfilled and the data in the variable "data" should have completely valid totals.
                        if (data.checkoutTruths.totals.total != 0) {
                            // Charge user card agreed upon amount
                            let charged = await cc.chargeFirstValidCard(userCCsData, userStripeData, data.checkoutTruths.totals.total);
                            if (!charged) {
                                return res.json({ cartData: data, error: "The purchase was not completed. Your account was not charged" });
                            }
                            let requiresReview = false;
                            if (charged.amountCharged != charged.total) { // If the amount we were supposed to charge is not equal to the amount charged then the order will require manual review
                                requiresReview = true;
                            }
                            // Make single order record on Database
                            let orderRecord = await bookKeeping.saveOrderFulfillmentRecord(data, userStripeData, charged, requiresReview, false);
                            console.log(orderRecord);
                            if (orderRecord) {
                                if (orderRecord.shops) {
                                    // set references for shops involved in order. Orders will be saved as a single document and shops will have order references relevant to them. As opposed to building multiple different orders per shop
                                    let orderDatas = orderRecord.shops.map(shop => { // Organize owed totals for each shop to do payouts
                                        let shopShippingTotal = 0;
                                        let shopProductTotal = 0;
                                        let shopCompleteTotal = 0;
                                        for (let i = 0; i < orderRecord.cart.length; i++) {
                                            if (orderRecord.cart[i].shopId == shop.id) {
                                                shopShippingTotal += orderRecord.cart[i].calculatedShipping;
                                                shopProductTotal += orderRecord.cart[i].calculatedTotal;
                                                shopCompleteTotal += orderRecord.cart[i].calculatedShipping + orderRecord.cart[i].calculatedTotal;
                                            }
                                        }
                                        return {
                                            shop: shop.id,
                                            shippingTotal: shopShippingTotal,
                                            productTotal: shopProductTotal,
                                            completeTotal: shopCompleteTotal,
                                            orderId: orderRecord._id
                                        };
                                    });
                                    if (!requiresReview) {
                                        // Run payouts
                                        let paymentPromises = orderDatas.map(async shopPaymentData => {
                                            return await cc.paySingleVendor(shopPaymentData) // each orderDatas do promise
                                        });
                                        orderDatas = await Promise.all(paymentPromises);
                                    } else {
                                        // Requires review, do not run payouts yet, just empty cart and return data. Add to customer service queue later
                                        
                                    }
                                    let promises = orderRecord.shops.map(async shop => {
                                        let paid = null;
                                        function getShopIndex(shopId) {
                                            for (let i = 0; i < orderDatas.length; i++) {
                                                if (shopId == orderDatas[i].shop) {
                                                    if (orderDatas[i].results) {
                                                        paid = orderDatas[i].results;
                                                    }
                                                    return orderDatas[i];
                                                }
                                            }
                                            return {};
                                        }
                                        let orderObject = {
                                            orderId: orderRecord._id,
                                            bill: getShopIndex(shop.id),
                                            paid: paid
                                        }
                                        return await bookKeeping.associateOrderWithShop(shop.id, orderObject);
                                    });
                                    let shopOrderAssociations = await Promise.all(promises); // Will save each order on shop records in mongoDb
                                    let emptiedUserCart = await cart.emptySingleUserCart(req.body.username);
                                    return res.json({
                                        orderRecord: orderRecord,
                                        cartData: emptiedUserCart,
                                        error: null
                                    });
                                }
                            }
                        } else {
                            // free checkout, skip payments and create records

                        }
                    }
                    return res.json({ cartData: data, error: "The purchase was not completed. Your account was not charged" });
                }
            }
        } else {
            return res.json({ cartData: data, error: "The purchase was not completed. Your account was not charged" });
        }
    } catch (err) {
        console.log(err);
        return res.json({ cartData: null, error: "Failed to complete checkout. Your account was not charged" });
    }
}

const setProductsQuantites = async(req, res, next) => {
    try {
        if (req.body.self && req.body.username && req.body.products) {
            let result = await users.setProductsQuantities(req.body.username, req.body.products);
            if (result) {
                if (result.error) {
                    return res.json({ data: null, error: "did not complete" });
                } else { 
                    let newCart = await ecommerce.getCart(req.body.username);
                    if (newCart) {
                        return res.json({ data: result.data, error: "", cart: newCart });
                    } else {
                        return res.json({ data: result.data, error: "" });
                    }
                }
            } else {
                return res.json({ data: null, error: "did not complete" });
            }
        } else {
            return res.json({ data: null, error: "did not complete" });
        }
    } catch (err) {
        return res.json({ data: null, error: "did not complete" });
    }
}

const updateSingleShippingOnProduct = async(req, res, next) => {
    try {
        if (req.body.username && req.body.productData && req.body.shippingRule) {
            let result = await products.changeShippingClass(req.body.username, req.body.productData, req.body.shippingRule);
            if (result) {
                return res.json({
                    data: result.data,
                    error: result.error,
                    success: result.success
                });
            } else {
                return res.json({
                    data: null,
                    error: "failed to update shipping class"
                });
            }
        } else {
            return res.json({
                data: null,
                error: "failed to update shipping class"
            });
        }
    } catch (err) {
        return res.json({
            data: null,
            error: "failed to update shipping class"
        });
    }
}

const getSingleOrder = async(req, res, next) => {
    try {
        if (req.body.orderId && req.body.username) {
            let orderData = await orders.getSingleOrder(req.body.orderId, req.body.username);
            console.log(orderData);
            if (orderData) {
                return res.json({
                    data: orderData,
                    error: null
                });
            } else {
                throw new Error;
            }
        } else {
            throw new Error;
        }
    } catch (err) {
        return res.json({
            data: null,
            error: "failed to get order"
        });
    }
}

router.post('/savesingleproducttoshop', uploadSpace.array('image', 10), (req, res, next) => {
    return saveSingleProduct(req, res, next);
});

router.post('/getshippingclasses', (req, res, next) => {
    return getShippingClasses(req, res, next);
});

router.post('/saveshippingclass', (req, res, next) => {
    return saveShippingClass(req, res, next);
});

router.post('/getshopproducts', (req, res, next) => {
    return getShopProducts(req, res, next);
});

router.post('/getsingleproductpagedata', (req, res, next) => {
    return getSingleProduct(req, res, next);
});

router.post('/saveshippingdataonuser', (req, res, next) => {
    return saveShippingDataOnUser(req, res, next);
});

router.post('/fetchusershippingdata', (req, res, next) => {
    return fetchUserShippingData(req, res, next);
});

router.post('/addoneproducttocart', (req, res, next) => {
    return addOneProductToCart(req, res, next);
});

router.post('/getimagesandtitlesforcartproducts', (req, res, next) => {
    return getImagesAndTitlesForCartProducts(req, res, next);
});

router.post('/setproductquantites', (req, res, next) => {
    return setProductsQuantites(req, res, next);
});

router.post('/updatesingleshippingonproduct', (req, res, next) => {
    return updateSingleShippingOnProduct(req, res, next);
});

router.post('/processcompletecheckout', (req, res, next) => {
    return processCompleteCheckout(req, res, next);
});

router.post('/getsingleorder', (req, res, next) => {
    return getSingleOrder(req, res, next);
});

router.get('/hello', (req, res, next) => {
    return res.json("Hey welcome to minishops")
});

module.exports = router;