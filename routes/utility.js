const fs = require('fs');

/* Deletes one file cleanly */
const deleteOne = async (filePath) => {
    try {
        if (filePath) {
            if (typeof filePath === 'string') {
                fs.unlink(filePath, (err) => {
                    if (err) {
                        return false;
                        throw err;
                    } else {
                        console.log(filePath + " deleted");
                        return true;
                    }
                });
            }
        }
        return false;
    } catch (err) {
        // File did not delete or was already deleted
        return false;
    }
}

const convertTime = function(ms) {
    try {
        return new Date(ms).toLocaleString();
    } catch (err) {
        return ms;
    }
}

module.exports = {
    deleteOne: deleteOne,
    convertTime: convertTime
}