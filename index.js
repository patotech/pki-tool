const program = require('commander');
const fs = require('fs');
const fsOperations = require('./app_modules/fs_operations')
const certFlow = require('./app_modules/cert_flow')

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

program.parse(process.argv);