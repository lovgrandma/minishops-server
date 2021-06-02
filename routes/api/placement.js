/**
 * Placement file placement.js
 * @version 0.0.1
 * @author jesse Thompson
 * 
 * Gets and updates placement data for in video purchases
 */

const s3Cred = require('./s3credentials.js');
const s3Upload = require('./s3upload.js');
const neo4j = require('neo4j-driver');
const uuidv4 = require('uuid/v4');
const driver = neo4j.driver(s3Cred.neo.address, neo4j.auth.basic(s3Cred.neo.username, s3Cred.neo.password));

const getSingleVideoPlacementData = async function(videoId) {
    let session = driver.session();
    let query = "match (a:Video { id: $id}) return a";
    let params = { id: videoId };
    return await session.run(query, params)
        .then((result) => {
            if (result.records[0]._fields[0].properties.placement) {
                return result.records[0]._fields[0].properties.placement;
            }
            return null;
        })
        .catch((err) => {
            return null;
        })
};

module.exports = {
    getSingleVideoPlacementData: getSingleVideoPlacementData
}