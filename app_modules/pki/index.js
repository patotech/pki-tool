const childProc = require('child_process');
const path = require('path');
const http = require('http');
const tmp = require('tmp');
const fs = require('fs');

const disableIntermediatePkiEngine = function( vaultBinary, vaultUrlPath, vaultToken ) {
    console.log('Disabling PKI secret engine at ' + vaultUrlPath);
    const vaultLoginCommand = [
        vaultBinary,
        'login',
        vaultToken
    ];
    try {
        childProc.execSync( vaultLoginCommand.join(' ') );
        var vaultDisablePkiSecret = [
            vaultBinary,
            'secrets',
            'disable',
            vaultUrlPath
        ];
        childProc.execSync( vaultDisablePkiSecret.join(' ') );
    } catch ( error ) {
        console.log("Could not create PKI engine");
    }
};

const createServiceRole = function( vaultUrlPath, vaultToken ) {
    const createRoleRequest = {
        "allowed_domains": ["example.com"],
        "allow_subdomains": true
        };

    const postData = JSON.stringify( createRoleRequest );

    const createServiceRoleRequest = {
        hostname: 'localhost',
        port: 8200,
        path: '/v1/' + vaultUrlPath + '/roles/services',
        method: 'POST',
        headers: {
            'X-Vault-Token': vaultToken,
            'Content-Length': Buffer.byteLength( postData ),
            'Content-Type': 'application/json'
        }
    };

    const req = http.request( createServiceRoleRequest, (res) => {
        var data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            console.log('Service Role Created');
        });        
    });

    req.on('error', (e) => {
        console.error(`problem creating service role: ${e.message}`);
    });

    req.write( postData );
    req.end();    
}

const createIntermediatePkiEngine = function( vaultBinary, vaultUrlPath, vaultToken ) {
    console.log('Creating PKI secret engine at ' + vaultUrlPath);
    try {
        const vaultLoginCommand = [
            vaultBinary,
            'login',
            vaultToken
        ];
        childProc.execSync( vaultLoginCommand.join(' ') );
        var vaultCreatePkiSecret = [
            vaultBinary,
            'secrets',
            'enable',
            '-path=' + vaultUrlPath,
            'pki'
        ];
        childProc.execSync( vaultCreatePkiSecret.join(' ') );
        var vaultTunePkiSecret = [
            vaultBinary,
            'secrets',
            'tune',
            '-max-lease-ttl=336h',
            vaultUrlPath
        ];
        childProc.execSync( vaultTunePkiSecret.join(' ') );

    } catch ( error ) {
        console.log("Could not create PKI engine");
    }
};

const buildTrustChain = function( baseCaFolder ) {
    const caFolder = path.resolve( baseCaFolder );
    const parentCaFolder = path.resolve( baseCaFolder + path.sep + '..' );
    const caName = caFolder.split(path.sep).pop();

    var caPublicFileName = '';
    if( caName == 'root' ) {
        caPublicFileName = caName + '.pem';
    } else {
        caPublicFileName = caName + '-intermediate.pem';
    }
    const caPublicFilePath = path.resolve( caFolder + path.sep + caPublicFileName );
    var publicCa = fs.readFileSync( caPublicFilePath );

    if( caName == 'root' ) {
        return publicCa;
    } else {
        return publicCa + buildTrustChain( parentCaFolder );
    }
};

const uploadSignedCertificate = function( parentCaDir, signedRequest, vaultUrlPath, vaultToken ) {
    var trustChain = "";
    try {
        trustChain = buildTrustChain( parentCaDir );
        console.log('Trust Chain :\n'+trustChain);
    } catch ( error ) {
        console.log('Error building trust chain: ' + error);
    }

    if( trustChain ) {
        const signedCaRequest = {
            'certificate': signedRequest + '\n' + trustChain
        };

        const postData = JSON.stringify( signedCaRequest );
        console.log("Signed request : " + postData);

        const uploadSignedCa = {
            hostname: 'localhost',
            port: 8200,
            path: '/v1/' + vaultUrlPath + '/intermediate/set-signed',
            method: 'POST',
            headers: {
                'X-Vault-Token': vaultToken,
                'Content-Length': Buffer.byteLength( postData ),
                'Content-Type': 'application/json'
            }
        };
    
        const req = http.request( uploadSignedCa, (res) => {
            var data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                createServiceRole( vaultUrlPath, vaultToken );
                console.log('Certificate Uploaded - Ready to Use');
            });        
        });
    
        req.on('error', (e) => {
            console.error(`problem uploading singed certificate: ${e.message}`);
        });
    
        req.write( postData );
        req.end();    
    } else {
        console.log('Cannot upload an empty trust chain');
    }
};

const signCertificate = function( parentCaDir, certResponse, vaultUrlPath, vaultToken ) {
    const parentCaFolder = path.resolve( parentCaDir );
    const parentCaPublicFileName = parentCaFolder.split(path.sep).pop() + '-intermediate.pem';
    const parentCaPrivateFileName = parentCaFolder.split(path.sep).pop() + '-key.pem';
    const parentCaPublicFilePath = path.resolve( parentCaDir + path.sep + parentCaPublicFileName );
    const parentCaPrivateFilePath = path.resolve( parentCaDir + path.sep + parentCaPrivateFileName );
    const vaultCert = JSON.parse( certResponse );

    const vaultIntermediateConfig = {
        "signing": {
            "default": {
                "usages": [
                    "signing",
                    "key encipherment",
                    "cert sign",
                    "crl sign"
                ],
                "expiry": "336h",
                "is_ca": true,
                "ca_constraint": {
                    "is_ca": true,
                    "max_path_len": 0,
                    "max_path_len_zero": false
                }
            }
        }
    };

    var tmpVaultPublicCert = tmp.fileSync();
    var tmpVaultPublicCertConfig = tmp.fileSync();
    var tmpDir = tmp.dirSync();
    var intermediatePemName = path.resolve( tmpDir.name, 'vault-intermediate' );
    fs.writeFileSync( tmpVaultPublicCert.fd, vaultCert.data.csr );
    fs.writeFileSync( tmpVaultPublicCertConfig.fd, JSON.stringify( vaultIntermediateConfig ) );
    console.log( "Signing Certificate: \n" + vaultCert.data.csr );

    try {
        var cfsslCommand = [
            'cfssl','sign',
            '-ca',parentCaPublicFilePath,
            '-ca-key',parentCaPrivateFilePath,
            '-config',tmpVaultPublicCertConfig.name,
            tmpVaultPublicCert.name,
            '|',
            'cfssljson','-bare', intermediatePemName
        ];
        childProc.execSync( cfsslCommand.join(' ') );
        console.log('Signed cert writed to ' + intermediatePemName + '.pem');
        var signedCa = fs.readFileSync( intermediatePemName + ".pem" );
        console.log("Signed Cert :\n" + signedCa);

    } catch ( error ) {
        console.log("Error signing intermediate CA: " + error);
    }
    uploadSignedCertificate( parentCaDir, signedCa, vaultUrlPath, vaultToken );
};

const createIntermediateCA = function( parentCaDir, caInfo, vaultUrlPath, vaultToken ) {
    const postData = JSON.stringify(caInfo);
    const generateCaOptions = {
        hostname: 'localhost',
        port: 8200,
        path: '/v1/' + vaultUrlPath + '/intermediate/generate/internal',
        method: 'POST',
        headers: {
            'X-Vault-Token': vaultToken,
            'Content-Length': Buffer.byteLength( postData ),
            'Content-Type': 'application/json'
        }
    };

    const req = http.request( generateCaOptions, (res) => {
        var data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            signCertificate( parentCaDir, data, vaultUrlPath, vaultToken );
        });        
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    req.write( postData );
    req.end();    
};

const createIntermediate = function( parentCaDir, vaultDirPath, vaultUrlPath, vaultToken, commonName, options ) {
    const vaultBinary = path.resolve( vaultDirPath + path.sep + 'vault.exe' );
    const intermediateFolder = path.resolve( parentCaDir );
    const intermediatePublicFile = intermediateFolder.split(path.sep).pop() + '-intermediate.pem';
    const intermediatePrivateFile = intermediateFolder.split(path.sep).pop() + '-key.pem';
    console.log('Vault Binary             : ' + vaultBinary);
    console.log('Intermediate Directory   : ' + intermediateFolder);
    console.log('Intermediate Public File : ' + intermediatePublicFile);
    console.log('Intermediate Private File: ' + intermediatePrivateFile);
    console.log('Hashicorp Vault Token    : ' + vaultToken);

    if( options.replace ) {
        disableIntermediatePkiEngine( vaultBinary, vaultUrlPath, vaultToken );
    }
    createIntermediatePkiEngine( vaultBinary, vaultUrlPath, vaultToken );
    const caInfo = {
        'common_name': commonName
    };
    if( options.organization ) {
        caInfo.organization = options.organization;
    }
    if( options.ou ) {
        caInfo.ou = options.ou;
    }
    if( options.country ) {
        caInfo.country = options.country;
    }
    if( options.locality ) {
        caInfo.locality = options.locality;
    }
    if( options.province ) {
        caInfo.province = options.province;
    }
    if( options.street ) {
        caInfo.street_address = options.street;
    }
    if( options.postalCode ) {
        caInfo.postal_code = options.postalCode;
    }
    if( options.names ) {
        caInfo.alt_names = options.names;
    }
    
    createIntermediateCA( parentCaDir, caInfo, vaultUrlPath, vaultToken );
};

module.exports = { createIntermediate };