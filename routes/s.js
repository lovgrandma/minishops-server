/**
 * Main routes file for shops s.js
 * @version 0.0.1
 * @author jesse Thompson
 * 
 * Routes calls for shop functionality
 */

const router = require('express').Router();
const products = require('./api/products.js');

router.post('/getshopproducts', (req, res, next) => {
    console.log(req.body);
    return res.json({ querystatus: "getshoproducts response"});
});

router.get('/hello', (req, res, next) => {
    return res.json("Hey welcome to minishops")
});

module.exports = router;