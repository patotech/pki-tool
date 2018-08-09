const fsOperations = require('../fs_operations');
const cfssl = require('../cfssl');
const path = require('path');
const fs = require('fs');

const generate = function ( sourceDir, targetDir ) {
    var caNameFromDir = path.basename( sourceDir );
    var workingTargetDir = path.resolve( targetDir, caNameFromDir );
    fsOperations.mkdirpSync( workingTargetDir );

    processPath( sourceDir, workingTargetDir );
};

function processPath( workingSource, workingTarget ) {
    var fileList = [];
    fs.readdirSync( workingSource ).forEach( function( fileName ) {
        var candidatePath = path.resolve( workingSource, fileName );
        var pathStat = fs.statSync( candidatePath );
        var fileDetail = {
            "name": fileName,
            "isDir": pathStat.isDirectory()
        };
        fileList.push( fileDetail );
    });
    // First we need to process files
    fileList.forEach( function( file ) {
        if( !file.isDir ) {
            processFile( workingSource, file.name, workingTarget );
        }
    });
    // Then we can work with directories
    fileList.forEach( function( file ) {
        if( file.isDir ) {
            var subDirectory = path.resolve( workingSource, file.name );
            var subWorkingTarget = path.resolve( workingTarget, file.name );
            console.log("Creating directory for: %s", subDirectory );
            fsOperations.mkdirpSync( subWorkingTarget );
            processPath( subDirectory, subWorkingTarget );
        }
    });
}

function processFile( sourceDir, fileName, workingTargetDir ) {
    var currentFile = path.resolve( sourceDir, fileName );
    if ( fileName == "root-csr.json" ) {
        console.log("Procesing root CA: %s", currentFile );
        cfssl.initCA( sourceDir, 'root-csr.json', workingTargetDir );
    } else if ( fileName == "intermediate-config.json" ) {
        var parentCaPath = path.resolve( workingTargetDir, ".." );
        console.log("Procesing intermediate CA: %s", currentFile );
        console.log(" - Parent CA Dir: %s", parentCaPath );
        console.log(" - CA Dir: %s", sourceDir );
        console.log(" - Out Dir: %s", workingTargetDir );
        cfssl.initIntermediate( parentCaPath, sourceDir, workingTargetDir );
    } else if ( fileName == "service-config.json" ) {
        var parentCaPath = path.resolve( workingTargetDir, ".." );
        cfssl.serviceCertificate( parentCaPath, sourceDir, workingTargetDir );
    }
}

module.exports = { generate };