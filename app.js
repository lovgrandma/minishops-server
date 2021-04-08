/**
 * @author Jesse Thompson admin@minipost.app
 * @version 0.0.1
 * @License GNU General Public License, version 2.0
 * Copyright (c) 2021 Minipost LLC
 * 
 * The use of this software is hereby explicitly restricted with specific provisions
 * allowed for users with a license who wish to reuse it for commercial profit in their own private
 * endeavor. A complete written license is required from Minipost LLC in order to 
 * use any copy or form of this software and associated documentation files (the "Software"), 
 * for profit of any kind. 
 * 
 * With explicit restriction, a license allows the use, copying, modification, publishing and sale
 * of this software. Please contact admin@minipost.app or use the contact form at www.minipost.app
 * to retrieve a license for this software. Any unpublished, non distributed, not-for-profit,
 * non-commercial use on a single local machine per user is granted.
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 * 
 */

'use strict';

const cluster = require('cluster');
const express = require('express');
const fs = require('fs');
const mongoose = require('mongoose');
const assert = require('assert');
const path = require('path');
const app = express();
const cors = require('cors');
const privateKey = fs.readFileSync('minipost-server-key.key');
const certificate = fs.readFileSync('minipost-server-certificate.crt');
const bundle = fs.readFileSync('minipost-server-bundle.ca-bundle');
const options = {
    key: privateKey,
    cert: certificate,
    ca: bundle
};

let server;
if (process.env.dev) {
    server = require('http').createServer(app);
} else {
    server = require('https').createServer(options, app);  // Set to https to force https connections to api
}
const shops = require('./routes/s');
const { resolveLogging } = require('./scripts/logging.js');
const s3Cred = require('./routes/api/s3credentials.js');

const whitelist = [ 'https://www.minipost.app', 'https://minipost.app', 'www.minipost.app', 'minipost.app', 'http://localhost:3000' ];
app.use(cors({
    origin: function(origin, callback) {
        if (whitelist.indexOf(origin) !== -1) { // Add function to filter through foreign whitelist origins 
            callback(null, true);
        } else {
            callback(new Error("Not allowed"));
        } 
    },
    optionsSuccessStatus: 200,
    credentials: true
}));
app.use(express.json({
    type: function(req) {
        if (req.get('content-type')) {
            return req.get('content-type').indexOf('multipart/form-data') !== 0;
        } else {
            return true;
        }
    },
    limit: "50mb" // Set higher body parser limit for size of video objects
}));
app.use(express.urlencoded({ extended: false })); // Parse post requests

const mongoOptions = {
    auth: {authdb: s3Cred.mongo.authDb },
    user: s3Cred.mongo.u,
    pass: s3Cred.mongo.p,
    dbName: s3Cred.mongo.dbName,
    useNewUrlParser: true,
    useUnifiedTopology: true
};

// connect mongoose // Limited mongo access for shops only
// Read all dbs, CRUD for shops
mongoose.connect(s3Cred.mongo.address, mongoOptions)
    .then(() => resolveLogging() ? console.log('MongoDB Connected') : null)
    .catch(err => console.log(err));

const db = mongoose.connection;
//mongo error
db.on('error', console.error.bind(console, 'connection error:'));

// Add headers. Dont include credentials. Allow all origins for embeds
app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin); // Website you wish to allow to connect. 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept'); // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Credentials', true); // Set to true if you need the website to include cookies in the requests sent to the API
    next();
});

// This would call the shop record on neo4j and see allowed origins as decided by administrator
// If origin is not listed on db, bad request, else next
app.use(async function(req, res, next) {
    if (req.body) {
        if (req.body.owner) {
            // check if shop record site origins includes -> req.headers.origin.
            // If this is false that means the embed was included on a website that minipost did not approve in its db
            next();
        } else {
            next();
        }
    } else {
        return res.json({ error: "No body. Something went wrong", action: "refuse" });
    }
});

app.use('/s/', shops);

////// Catch all 404, forward to error handler. 
app.use(function(err, req, res, next) {
    if (!err) {
        var err = new Error('File Not Found');
        err.status = 404;
    }
    next(err);
});

// Custom Error Handler replacing default
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({
        error: err.message,
        type: err.type
    });
    console.log(err);
});

const port = s3Cred.app.port;
server.setTimeout(10*60*1000);
server.listen(port, () => resolveLogging() ? console.log(`Minishops server started on port ${port}`) : null);

module.exports = app;