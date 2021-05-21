/**
 * Products interface file shippingclasses.js
 * @version 0.0.1
 * @author jesse Thompson
 * 
 * Gets and updates shipping classes on shop
 */

const s3Cred = require('./s3credentials.js');
const neo4j = require('neo4j-driver');
const uuidv4 = require('uuid/v4');
const { validate } = require('uuid');
const driver = neo4j.driver(s3Cred.neo.address, neo4j.auth.basic(s3Cred.neo.username, s3Cred.neo.password));

/**
 * Will read shipping classes for a specific shop and return as an array of objects
 * 
 * @param {String} owner Gets shop by owner
 * @param {String} username Authenticated user to update data. Necessary as shop owner can have employees
 * @returns {Object[] || false } shippingClass Array of objects for shipping classes or false meaning failure to get classes
 **/
const getShippingClassesOfShop = async (owner) => {
    let session = driver.session();
    let query = "match (a:Person { name: $owner })-[r:OWNS]-(b:Shop) return b";
    let params = { owner: owner };
    return await session.run(query, params)
        .then(function async(result) {
            if (result) {
                if (result.records) {
                    if (result.records[0]) {
                        if (result.records[0]._fields) {
                            if (result.records[0]._fields[0]) {
                                if (result.records[0]._fields[0].properties.shippingClasses) {
                                    try {
                                        JSON.parse(result.records[0]._fields[0].properties.shippingClasses);
                                        return {
                                            shippingClasses: JSON.parse(result2.records[0]._fields[0].properties.shippingClasses),
                                            owner: owner
                                        }
                                    } catch (err) {
                                        return {
                                            shippingClasses: [],
                                            owner: owner
                                        };
                                    }
                                } else {
                                    return {
                                        shippingClasses: [],
                                        owner: owner
                                    };
                                }
                            }
                        }
                    }
                }
            }
            return false;
        })
        .catch(function (err) {
            return false;
        });
}

/**
 * Will create or update a shipping class depending on whether a shipping class with matching uuid exists or not.
 * Should return all shipping classes
 * 
 * @param {String} owner Gets shop by owner
 * @param {String} username Authenticated user to update data. Necessary as shop owner can have employees
 * @param {{ShippingClass}} ShippingClass Proposed shipping class to create or update
 * @param {String} uuid Existing or null value of uuid. Do create if null or no matching name, do update if valid and copy exists or matching name
 * @returns {String, Object[], String || false} shippingClass Array of objects for all shipping classes, name of shop and name of owner for shop
 */
const saveOneShippingClassToShop = async (owner, username, data, uuid = null) => {
    try {
        let international = false;
        if (data && owner) {
            if (data.hasOwnProperty("international")) {
                international = data.international;
            }
            const validatedShippingClass = checkShippingClassIntegrity(data);
            console.log(validatedShippingClass);
            if (validatedShippingClass) { // The passed shipping data has been stripped for extraneous data and is ready to be saved on the db
                if (!uuid) {
                    uuid = uuidv4().split("-").join(""); // Only needs to be unique to the Shop. Not the database. Shipping classes are only valid to the individual shop // If a uuid doesnt exist, we are probably creating a new shipping class (Probably meaning if we find a name match, we do not treat it as new)
                }
                validatedShippingClass.uuid = uuid; // Set uuid before checking for shipping class matches
                let session = driver.session();
                let query = "match (a:Person { name: $owner })-[r:OWNS]-(b:Shop) return b";
                let params = { owner: owner };
                return await session.run(query, params)
                    .then(async function(result) {
                        session.close();
                        if (result) {
                            if (result.records) {
                                if (result.records[0]) {
                                    if (result.records[0]._fields) {
                                        if (result.records[0]._fields[0]) {
                                            if (result.records[0]._fields[0].properties.shippingClasses) {
                                                try {
                                                    JSON.parse(result.records[0]._fields[0].properties.shippingClasses);
                                                    return JSON.parse(result.records[0]._fields[0].properties.shippingClasses);
                                                } catch (err) {
                                                    return [];
                                                }
                                            } else {
                                                return [];
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        return false;
                    })
                    .then(async function(result) {
                        if (result && Array.isArray(result)) { // valid array for shipping classes from database. If this doesn't exist the record is corrupted which is a deeper technical problem
                            let checkMatch = checkShippingClassesMatch(result, validatedShippingClass);
                            if (checkMatch == -1) { // no match, create new 
                                result.push(validatedShippingClass);
                            } else { // match, update existing shipping class
                                if (result[checkMatch].shippingRule == "International") {
                                    // If the match function returns a match by uuid and is the index of the international rule (match by name), we will merge the name of the validatedShippingClass to "International" and proceed. This will ensure that there are never 2 or more international rules
                                    validatedShippingClass.shippingRule = "International";
                                }
                                if (result[checkMatch].uuid) {
                                    validatedShippingClass.uuid = result[checkMatch].uuid; // Retain the same uuid before update
                                }
                                result[checkMatch] = validatedShippingClass;
                            }
                            let session2 = driver.session();
                            query = "match (a:Person { name: $owner })-[r:OWNS]-(b:Shop) set b.shippingClasses = $newShippingClassesArr return b";
                            let newShippingClassesArr = JSON.stringify(result);
                            params = { newShippingClassesArr: newShippingClassesArr, owner: owner };
                            return await session2.run(query, params)
                                .then((result2) => {
                                    if (result2) {
                                        if (result2.records) {
                                            if (result2.records[0]) {
                                                if (result2.records[0]._fields) {
                                                    if (result2.records[0]._fields[0]) {
                                                        if (result2.records[0]._fields[0].properties.shippingClasses) {
                                                            return {
                                                                shippingClasses: result2.records[0]._fields[0].properties.shippingClasses,
                                                                owner: owner
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    };
                                    return false;
                                })
                                .catch((err) => {
                                    return false;
                                })
                        } else {
                            return false;
                        }
                    })
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
 * Will delete a shipping class if it exists
 * 
 * @param {String} owner
 * @param {String} uuid
 * @returns {Object[]} shippingClass Array of objects for all shipping classes (new, after delete)
 */
const deleteOneShippingClassOfShop = async (owner, uuid) => {

}

/**
 * Will determine if there is a match already existing in the 
 * @param {*} shippingClasses 
 * @param {*} proposedClass 
 * @returns {Number} Returns -1 meaning false no match or 
 */
const checkShippingClassesMatch = function(shippingClasses, proposedClass) {
    try {
        let match = -1;
        for (let i = 0; i < shippingClasses.length; i++) {
            // Check each shipping class in the database to see if the uuid or the name matches. If either matches we will overwrite that data instead of creating new
            if (shippingClasses[i].uuid == proposedClass.uuid || shippingClasses[i].shippingRule == proposedClass.shippingRule) {
                match = i;
                break;
            }
        }
        return match;
    } catch (err) {
        return -1;
    }
}


/**
 * Will check the integrity of a shipping class before it enters the database
 * Shipping classes are appended to the database on shop records in an array property called ShippingClasses. Since we are ingesting a whole object
 * we want to check the integrity and only take values that would result in a valid shipping class
 * 
 * @param {Object} nonvalidated shippingClass
 * @returns {Object} validated shippingClass 
 */
const checkShippingClassIntegrity = function(shippingClass) {
    try {
        if (shippingClass) {
            let validatedShippingClass = {
                shippingRule: "",
                selectedCountries: [],
                shippingPrice: 0.00,
                perProduct: false,
                international: false
            }
            if (shippingClass.shippingRule) {
                if (shippingClass.shippingRule.length > 0) {
                    validatedShippingClass.shippingRule = shippingClass.shippingRule;
                } else {
                    return false;
                }
            } else {
                return false;
            }
            if (shippingClass.selectedCountries) {
                if (shippingClass.selectedCountries.length > 0) {
                    validatedShippingClass.selectedCountries = shippingClass.selectedCountries;
                } else {
                    return false;
                }
            } else {
                return false;
            }
            try {
                if (typeof parseFloat(shippingClass.shippingPrice) == "number") {
                    let shippingPrice = null;
                    try {
                        shippingPrice = parseFloat(shippingClass.shippingPrice).toFixed(2);
                    } catch (err) {
                        return false;
                    }
                    // Value should be above -1. Meaning you can ship for free but you cannot put a nonsensical value
                    if (shippingClass.shippingPrice > -0.01) { 
                        validatedShippingClass.shippingPrice = shippingClass.shippingPrice;
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }
            } catch (err) {
                return false;
            }
            if (shippingClass.perProduct) {
                validatedShippingClass.perProduct = true;
            }
            if (shippingClass.international) {
                validatedShippingClass.international = shippingClass.international;
            }
            return validatedShippingClass;
        } else {
            return false;
        }
    } catch (err) {
        return false;
    } 
}

module.exports = {
    getShippingClassesOfShop: getShippingClassesOfShop,
    saveOneShippingClassToShop: saveOneShippingClassToShop,
    deleteOneShippingClassOfShop: deleteOneShippingClassOfShop
}