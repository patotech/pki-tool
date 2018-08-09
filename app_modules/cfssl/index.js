const childProc = require('child_process');
const path = require('path');

const initCA = function( caDir, csrFileName, outDir ) {
    var csrPath = path.resolve( caDir, csrFileName );
    var caName = path.basename( caDir );
    var outDirPath = path.resolve( outDir, caName );
    childProc.execSync('cfssl genkey -initca '+csrPath+' | cfssljson -bare '+outDirPath);
};

const initIntermediate = function( parentCADir, caDir, outDir ) {
    // First generate the certificate
    initCA( caDir, 'intermediate-csr.json', outDir );
    // Then sign it with the parent
    var parentCAName = path.basename( parentCADir );
    var caName = path.basename( caDir );
    var caPemFile = path.resolve( parentCADir, parentCAName+'.pem' );
    var caPemKeyFile = path.resolve( parentCADir, parentCAName+'-key.pem' );
    var configPath = path.resolve( caDir, 'intermediate-config.json' );
    var intermediateCsrPath = path.resolve( outDir, caName +'.csr' );
    var intermediatePemName = path.resolve( outDir, caName +'-intermediate' );
    var cfsslCommand = [
        'cfssl','sign',
        '-ca',caPemFile,
        '-ca-key',caPemKeyFile,
        '-config',configPath,
        intermediateCsrPath,
        '|',
        'cfssljson','-bare', intermediatePemName
    ];
    childProc.execSync( cfsslCommand.join(' ') );
};

const serviceCertificate = function( parentCADir, caDir, outDir ) {
    /*
    cfssl gencert \
           -ca crypto-config/intermediates/$caNivel1/$caNivel2/$caNivel2-intermediate.pem \
           -ca-key crypto-config/intermediates/$caNivel1/$caNivel2/$caNivel2-key.pem \
           -config intermediates/$caNivel1/$caNivel2/$caNivel3/app-config.json \
           -profile server \
           intermediates/$caNivel1/$caNivel2/$caNivel3/app-csr.json \
      | cfssljson -bare crypto-config/intermediates/$caNivel1/$caNivel2/$caNivel3/$caNivel3
    */

    // Then sign it with the parent
    var parentCAName = path.basename( parentCADir );
    var caName = path.basename( caDir );
    var caPemFile = path.resolve( parentCADir, parentCAName+'-intermediate.pem' );
    var caPemKeyFile = path.resolve( parentCADir, parentCAName+'-key.pem' );
    var configPath = path.resolve( caDir, 'service-config.json' );
    var serviceCsr = path.resolve( caDir, 'service-csr.json' );
    var serviceName = path.resolve( caDir, caName );
    var serviceOutDir = path.resolve( outDir, caName );

    var cfsslCommand = [
        'cfssl','gencert',
        '-ca',caPemFile,
        '-ca-key',caPemKeyFile,
        '-config',configPath,
        '-profile','server',
        serviceCsr,
        '|',
        'cfssljson','-bare', serviceOutDir
    ];
    childProc.execSync( cfsslCommand.join(' ') );
};

module.exports = { initCA, initIntermediate, serviceCertificate };