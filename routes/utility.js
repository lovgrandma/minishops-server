const fs = require('fs');

/* Deletes one file cleanly */
deleteOne = async (filePath) => {
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

module.exports = {
    deleteOne: deleteOne
}