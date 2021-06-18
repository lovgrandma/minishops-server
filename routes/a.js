/**
 * Admin routes file for shops a.js
 * @version 0.0.1
 * @author jesse Thompson
 * 
 * Route calls for admin actions
 */

const router = require('express').Router();
const path = require('path');
const admin = require('../admin/users.js');
const Admin = require('../models/admin.js');
const User = require('../models/user.js');

router.post('/buildshop', async (req, res, next) => {
    if (req.body.shop && req.body.owner) {
        let u = await User.findOne({ username: req.body.username }).lean();
        let auth = false;
        if (u) {
            if (u._id) {
                let adm = await Admin.findOne({ ref: u._id }).lean();
                if (adm) {
                    if (adm._id) {
                        auth = true;
                    }
                }
            }
        }
        if (auth) {
            let id = req.body.id ? req.body.id : null;
            let name = req.body.shop;
            let owner = req.body.owner;
            let description = req.body.description ? req.body.description : null;
            let createdShop = await admin.buildAShop(id, name, owner, description, null, null);
            return res.json(createdShop);
        } else {
            return res.json(false);
        }
        
    } else {
        return res.json(false);
    }
});

module.exports = router;