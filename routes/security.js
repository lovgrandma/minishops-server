/**
* This file is used to get encrypted usernames and compare encrypted usernames for authenticity.
* The flaw is that the hacker can use bcrypt themself and make their own hash. If they send a username and hash that are equal but its
* impersonating an account that they do not own the request will be successful.
* 
* For now if the hacker/user changes the username or encryptedUser it will result in an error and should force log out preventing
* changes to the application state/db. An encryption will be better since the app will be the only agent able to make encryptions and decrypt
* with use of a secret
*
* Long story short. In this scenario Encrypting > Hashing
*/

const encryption = require('../scripts/bcrypt/encryption.js');

/**
* Used to create a hash from a username. 
*
* @args Username
* @return {String encryptedUser} Will return encrypted username to store
*/
const getUsernameHash = async (username) => {
    if (username) {
        let encryptedUser = await encryption.bcrypt.hash(username, 10);
        return encryptedUser;
    } else {
        return false;
    }
}

/**
* This is used to determine if the provided username and hash are accurate. The hash must resolve to the username provided. 
* Otherwise the login session is corrupted and the user must be logged out on response.json
* This should run whenever information is being manipulated in the databases as a result of user action.
* Prevents imposters and ensures login authenticity.
*
* Simply put if the user changes the hash or the username in cookies. The login session is invalid
* 
* @args {String username, String hash} Needs a username to check against a hash.
* @return {Boolean} Will return whether or not check was valid or not
*/
const confirmUsernameHashAuthenticity = async (username, hash) => {
    if (username && hash) {
        return await new Promise((resolve, reject) => {
            encryption.bcrypt.compare(username, hash, function(error, result) {
                if (error) {
                    return reject(false);
                }
                if (result) {
                    return resolve(hash);
                } else {
                    return resolve(false);
                }
            })
        })
        .catch((err) => {
            return false;
        })
    } else {
        return false;
    }
}

module.exports = {
    getUsernameHash: getUsernameHash,
    confirmUsernameHashAuthenticity: confirmUsernameHashAuthenticity
}