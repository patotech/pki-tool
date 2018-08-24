const program = require('commander');
const certFlow = require('./app_modules/cert_flow');
const vault = require('./app_modules/vault_manager');
const vaultPki = require('./app_modules/pki');

var pjson = require('./package.json');

program
  .version( pjson.version )
  .description( pjson.description );

program
  .command('generate <configDir> <outputDir>')
  .alias('g')
  .description('Generate Certificate Tree')
  .action( (configDir, outputDir) => {
    console.log('Creating structure in: %s', outputDir);
    certFlow.generate( configDir, outputDir );
  });

program
  .command('vault <action>')
  .alias('v')
  .option('-d, --directory [path]', 'Hashicorp Vault Directory Path')
  .description('Manage a Hashicorp Vault Server')
  .action( ( action, options ) => {
    var vaultDir = '';
    if( !options.directory ) {
      vaultDir = 'c:\\vault';
    } else {
      vaultDir = options.directory;
    }
    vault.manageVault( vaultDir, action );
  });

program
  .command('create-intermediate <parentCADir> <vaultDirPath> <vaultUrlPath> <vaultToken> <commonName>')
  .alias('p')
  .option('-r, --replace', 'Replace current secret engine')
  .option('-o, --organization [organization]', 'CA Organization')
  .option('-u, --ou [organizational unit]', 'CA Organizational Unit')
  .option('-c, --country [country]', 'CA Country')
  .option('-l, --locality [locality]', 'CA Locality')
  .option('-p, --province [province]', 'CA Province')
  .option('-s, --street [street]', 'CA Street Address')
  .option('-t, --postalCode [postal code]', 'CA Postal Code')
  .option('-n, --names [other names]', 'CA Alternative Names')
  .description('Create a new intermediate CA in Vault using the parent CA indicated by the path')
  .action( ( parentCADir, vaultDirPath, vaultUrlPath, vaultToken, commonName, options ) => {
    vaultPki.createIntermediate( parentCADir, vaultDirPath, vaultUrlPath, vaultToken, commonName, options );
  });

program.parse(process.argv);