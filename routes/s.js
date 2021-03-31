/**
 * Main routes file for shops s.js
 * @version 0.0.1
 * @author jesse Thompson
 * 
 * Routes calls for shop functionality
 */

const router = require('express').Router();

router.get('/hello', (req, res, next) => {
    return res.json("Hey welcome to minishops")
})

module.exports = router;