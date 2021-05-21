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
            let data = await products.getImagesAndTitlesForCartProductsDb(req.body.cachedCart, username, getNewCart);
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
                // Check same checkout truths data, else return
                
                // Get good Stripe CC data on user acc , will check their mongoDB. Does not credit card check due to Stripe CC policy (Excessive to check CC's for validity. CC's are checked for accurate data when added to Stripe's db)
                let userStripeData = await cc.getUserStripeAccData(req.body.username);
                // Retrieve shop account and check valid receiving Stripe account for shop
                if (data.hasOwnProperty('checkoutTruths')) {
                    if (data.checkoutTruths.hasOwnProperty('shop')) {
                        let resolveShopCards = data.checkoutTruths.shop.map(shop => {
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
                        data.checkoutTruths.shop = await Promise.all(resolveShopCards);
                    }
                }
                let badShopCCData =[ ];
                for (let i = 0; i < data.checkoutTruths.shop.length; i++) {
                    if (data.checkoutTruths.shop[i].hasOwnProperty('CC')) {
                        if (!data.checkoutTruths.shop[i].CC.username || !data.checkoutTruths.shop[i].CC.shopCC) {
                            badShopCCData.push(data.checkoutTruths.shop[i]);
                        } 
                    } else {
                        badShopCCData.push(data.checkoutTruths.shop[i]);
                    }
                }
                if (!userStripeData) {
                    // No user CC data
                    return res.json({ cartData: data, error: "You'll need to add a valid Credit Card to your account to make purchases" });
                } else if (badShopCCData.length != 0) {
                    // No shop CC data
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
                        console.log(data.checkoutTruths);
                        // Charge user card
                        // send agreed finders fee to Minipost bank 15%-5%
                        // provide each shop with necessary payout
                        // Make record on Db (mongo)
                        // Empty user cart
                        // Send back record payment id for page redirect

                    }
                    return res.json({ cartData: data, error: "The purchase was not completed. Your account was not charged" });
                }
                
            }
        }
    } catch (err) {
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
})

router.get('/hello', (req, res, next) => {
    return res.json("Hey welcome to minishops")
});

module.exports = router;