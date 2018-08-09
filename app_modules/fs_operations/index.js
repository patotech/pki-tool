const fs = require('fs');
const path = require('path');

// Based on https://stackoverflow.com/questions/13696148/node-js-create-folder-or-use-existing
const mkdirSync = function (dirPath) {
    try {
        fs.mkdirSync(dirPath)
    } catch (err) {
        if (err.code !== 'EEXIST') throw err
    }
};

const mkdirpSync = function (dirPath) {
    var targetPath = path.resolve( dirPath );
    const parts = targetPath.split( path.sep );
  
    // For every part of our path, call our wrapped mkdirSync()
    // on the full path until and including that part
    for (let i = 1; i <= parts.length; i++) {
      mkdirSync(path.join.apply(null, parts.slice(0, i)));
    }
};

module.exports = { mkdirpSync, mkdirSync };