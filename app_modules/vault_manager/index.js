const childProc = require('child_process');
const parse = require('csv-parse/lib/sync');
const path = require('path');
const uuidv4 = require('uuid/v4');

const checkRunning = function() {
    try {
        var taskParams = [
            '/FI',
            'IMAGENAME eq vault.exe',
            '/FO',
            'CSV',
            '/NH'
        ];
        var taskListProc = childProc.spawnSync( "tasklist", taskParams );
        var records = parse( taskListProc.stdout, {columns: ['program','pid','sessionName','sessionNumber','memUsage']} );
        return records[0].pid;
    } catch ( error ) {
        return -1;
    }
};

const startVault = function( vaultDir ) {
    const vaultBinary = path.resolve( vaultDir + path.sep + 'vault.exe' );
    try {
        const vaultToken = uuidv4();
        const vaultCommand = [
            vaultBinary,
            'server',
            '-dev',
            '-dev-root-token-id='+vaultToken
        ];
        const cmdParams = [
            '/C',
            vaultCommand.join(' ')
        ];
        var vaultProc = childProc.spawn( 'cmd', cmdParams, {stdio: 'ignore', detached: true});
        vaultProc.unref();
        console.log('Starting with Token: ' + vaultToken);
    } catch ( error ) {
        console.log('There was a problem starting vault: ' + error);
    }
};

const stopVault = function( pid, force ) {
    try {
        const stopCommand = [
            '/PID',
            pid
        ];
        var vaultProc = childProc.spawn( 'taskkill', stopCommand, {stdio: 'inherit'});
        console.log('Stoping Hashicorp Vault PID: ' + pid);
    } catch ( error ) {
        console.log('There was a problem starting vault: ' + error);
    }
};

const manageVault = function( vaultDir, action ) {
    console.log("Hashicorp Vault Manager : ");
    console.log("  - Directory : " + vaultDir);
    var vaultPid = checkRunning();
    if( vaultPid == -1 ) {
        console.log("  - Current PID : Not running");
    } else {
        console.log("  - Current PID : " + vaultPid);
    }
    switch( action ) {
        case 'start':
            startVault( vaultDir );
            break;
        case 'stop':
            stopVault( vaultPid, false );
            break;
        case 'restart':
            stopVault( vaultPid, false );
            startVault( vaultDir );
            break;
        default:
            console.log("Unknown action requested, use start|stop|restart")
            break;
    };
};

module.exports = { manageVault };