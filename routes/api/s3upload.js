const fs = require('fs');
const path = require('path');
const s3cred = require("./s3credentials.js");
const uuidv4 = require("uuid/v4");
const aws = require('aws-sdk');
aws.config.update(s3cred.awsConfig);
const s3 = new aws.S3();
const sharp = require("sharp");

const { deleteOne } = require("../utility.js");

// Set timeout to delete one left over thumbfile
async function doImgDeletion(thumbFile) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(deleteOne(thumbFile));
        }, 1500);
    });
}

/**
 * Will upload a single file to any bucket and return the key and a name object if name was provided
 * @param {File{}} file 
 * @param {String} name 
 * @returns {False || Object}
 */
const uploadSingle = async (file, name = "", bucket, prefix = "", buffer = false) => {
    try {
        let checkExistingObject = null;
        let generatedUuid;
        let ext = file.filename.match(/.([a-zA-Z0-9]*)$/)[1];
        let uploadData;
        do {
            try {
                generatedUuid = uuidv4().split("-").join("");
                checkExistingObject = await s3.getObject({ Bucket: bucket, Key: prefix + generatedUuid + "." + ext, Range: "bytes=0-9" }).promise();
            } catch (err) { // No image was found with matching uuid, use current uuid for file
                i = 3;
                break;
            }
            if (await checkExistingObject) {
                generatedUuid = null;
            }
            i++;
        } while (i < 3);
        if (generatedUuid) {
            let compressedImg = await compressImg(file.path, ext, buffer);
            let data = fs.createReadStream(compressedImg);
            uploadData = await s3.upload({ Bucket: bucket, Key: prefix + generatedUuid + "." + ext, Body: data }).promise();
            doImgDeletion(file.path); // Delete origin file
            if (uploadData) {
                return doImgDeletion(compressedImg).then(() => { // Delete compressed image and return object values
                    return {
                        url: uploadData.Key,
                        name: name
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

const deleteSingle = async (ref, bucket) => {
    try {
        return new Promise( async (resolve, reject) => {
            let orig = null;
            try {
                orig = await s3.getObject({ Bucket: bucket, Key: ref }).promise();
            } catch (err) {
                console.log(err);
                // Fail silently no match
            }
            console.log(orig);
            if (orig) {
                await s3.deleteObject({ Bucket: bucket, Key: ref }, (err, data) => {
                    if (err) {
                        console.log(err);
                        reject(false); // Image deletion errored out
                    }
                    resolve(ref); // Image deleted
                });
            } else {
                resolve(ref); // Image was already deleted just return truthiness that its gone
            }
        });
    } catch (err) {
        console.log(err);
        return false;
    }
}

/**
* *** New Package "sharp". Image transforming library. Not sure of stability. Use try catch to prevent failure ***
* Compresses an image into jpeg format, deletes old and returns new
* 
* @arg {path} takes path of image to be converted
* @returns {jpeg} new compressed, resized image or false
*/
const compressImg = async(path, ext, buffer = false) => {
    try {
        if (path.match(/(\\|\/)([a-zA-Z0-9].*)\./)) {
            let newLoc = "temp\\" + path.match(/(\\|\/)([a-zA-Z0-9].*)\./)[2] + "-c." + ext;
            return new Promise((resolve, reject) => {
                sharp(path)
                    .resize(500, 785)
                    .png({ quality: 90 })
                    .toFile(newLoc)
                    .then((data) => { resolve(newLoc);  })
                    .catch((err) => { console.log(err); doImgDeletion(newLoc); reject(false) });
            })
        } else {
            return false;
        }
    } catch (err) {
        return false;
    }
}

module.exports = {
    uploadSingle: uploadSingle,
    deleteSingle: deleteSingle
}