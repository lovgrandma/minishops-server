const s3Cred = require('./s3credentials.js');
const neo4j = require('neo4j-driver');
const driver = neo4j.driver(s3Cred.neo.address, neo4j.auth.basic(s3Cred.neo.username, s3Cred.neo.password));
const utility = require('../utility.js');
const s3Upload = require('./s3upload.js');

async function getBucket(username) {
    try {
        let session = driver.session();
        let query = "match (a:Person { name: $name})-[r:OWNS]-(b:Bucket) return b";
        let params = { name: username };
        return await session.run(query, params)
            .then(async (result) => {
                session.close();
                if (result.records[0]._fields[0].properties) {
                    return JSON.parse(result.records[0]._fields[0].properties.files).reverse();
                }
                return [];
            })
            .catch((err) => {
                return [];
            })
    } catch (err) {
        return null;
    }
}

async function addFile(body, file) {
    try {
        console.log(body, file);
        // Check for existing bucket
        let session = driver.session();
        let query = "match (a:Person { name: $name})-[r:OWNS]-(b:Bucket) return b";
        let params = { name: body.username };
        return await session.run(query, params)
            .then(async (result) => {
                session.close();
                let bucket;
                if (result.records[0]) {
                    bucket = JSON.parse(result.records[0]._fields[0].properties.files);
                } else {
                    let session2 = driver.session();
                    query = "match (a:Person { name: $name }) create (b:Bucket { files: $files }) merge (b)-[r:OWNS]-(a) return b";
                    params = { files: "[]", name: body.username };
                    bucket = await session2.run(query, params)
                        .then((result) => {
                            session2.close();
                            return JSON.parse(result.records[0]._fields[0].properties.files);
                        })
                        .catch((err) => {
                            return false;
                        })
                }
                if (bucket) {
                    // upload to s3 repo
                    let rawName = file.filename.match(/\.([a-zA-Z0-9]*)$/)[0];
                    let loc = await s3Upload.uploadSingle(file, rawName, "minifs-vendor-repos1", "repo/", null);
                    if (loc) {
                        bucket.push({url: loc.url, size: loc.size, status: "waiting" });
                        bucket = JSON.stringify(bucket);
                        let session3 = driver.session();
                        query = "match (a:Person { name: $name})-[r:OWNS]-(b:Bucket) set b.files = $files return b";
                        params = { files: bucket, name: body.username };
                        return await session3.run(query, params)
                            .then((result) => {
                                if (result.records[0]) {
                                    return JSON.parse(result.records[0]._fields[0].properties.files).reverse();
                                }
                                return [];
                            })
                            .catch((err) => {
                                console.log(err);
                                return [];
                            })
                    } else {
                        throw new Error;
                    }
                }
            })
            .catch((err) => {
                console.log(err);
                return [];
            })
    } catch (err) {
        console.log(err);
        try {
            if (file) {
                if (file.path) {
                    setTimeout(() => {
                        utility.deleteOne(file.path);
                    }, 5000);
                }
            }
        } catch (err) {
            return false;
        }
        return false;
    }
}

module.exports = {
    getBucket: getBucket,
    addFile: addFile
}