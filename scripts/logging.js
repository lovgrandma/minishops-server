const cluster = require('cluster');

function resolveLogging() {
    let runLog = true;
    if (cluster.worker) {
        if (cluster.worker.id != 1) {
            return false;
        }
    }
    return runLog;
}

module.exports = { resolveLogging: resolveLogging };