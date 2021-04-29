/**
 * Main routes file for shops s.js
 * @version 0.0.1
 * @author jesse Thompson
 * 
 * Routes calls for shop functionality
 */

const router = require('express').Router();
const product = require('./api/products.js');
const shippingClasses = require('./api/shippingclasses.js');

const getShopProducts = async(req, res, next) => {
    let products = [];
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
            products = await product.getShopDbProducts(req.body.owner, filter, append);
        }
    }
    return res.json({ querystatus: "200", products: products });
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
    console.log(req.body);
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
    if (req.body) {
        if (req.body.self && req.body.owner && req.body.username && req.body.hash && req.body.product) {
            let data = await product.saveSingleProductToShop(req.body.owner, req.body.username, req.body.product);
            console.log(data);
            return res.json({ data: data });
        } else {
            return res.json({ error: "Save single product failed", action: null });
        }
    } else {
        return res.json({ error: "Save single product failed", action: null });
    }
}

router.post('/savesingleproducttoshop', (req, res, next) => {
    return saveSingleProduct(req, res, next);
})
router.post('/getshippingclasses', (req, res, next) => {
    return getShippingClasses(req, res, next);
});

router.post('/saveshippingclass', (req, res, next) => {
    return saveShippingClass(req, res, next);
});

router.post('/getshopproducts', (req, res, next) => {
    return getShopProducts(req, res, next);
});

router.get('/hello', (req, res, next) => {
    return res.json("Hey welcome to minishops")
});

module.exports = router;