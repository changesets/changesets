#!/usr/bin/env node

const changesetCommand = require('../changeset/changesetCommand');
const versionCommand = require('../version/versionCommand');
const publishCommand = require('../publish/publishCommand');
const initializeCommand = require('../initialize/initializeCommand');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Expected a command to run');
  console.error('`build-releases [changeset|version|publish|initialize]`');
  process.exit(1);
}

const command = args[0];
const flags = args.filter(arg => arg.startsWith('--'));

// TODO: Replace this entire thing with meow or something
// This is more complicated than flag.find because we want to make
// sure false values can be added to override config
const getFlagValue = flagName => {
  const flag = flags.find(f =>
    f.toLowerCase().match(`${flagName}=?`.toLowerCase()),
  );
  if (!flag) return flag;
  const [_, value] = flag.split('=');
  if (!value || value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`unknown option for ${flagName}: ${value}`);
};

let opts = { cwd: process.cwd() };

switch (command) {
  case 'initialize':
    initializeCommand(opts);
    break;
  case 'changeset':
    if (typeof getFlagValue('--commit') === 'boolean') {
      opts.commit = getFlagValue('--commit');
    }
    changesetCommand(opts);
    break;
  case 'version':
    if (typeof getFlagValue('--noChangelog') === 'boolean') {
      opts.noChangelog = getFlagValue('--noChangelog');
    }
    if (typeof getFlagValue('--skipCI') === 'boolean') {
      opts.skipCI = getFlagValue('--skipCI');
    }
    if (typeof getFlagValue('--commit') === 'boolean') {
      opts.commit = getFlagValue('--commit');
    }
    versionCommand(opts);
    break;
  case 'publish':
    if (typeof getFlagValue('--public') === 'boolean') {
      opts.public = getFlagValue('--public');
    }
    publishCommand(opts);
    break;
  default:
    console.error(
      `Invalid command ${command}, expected one of ['changeset', 'version', 'publish', 'initialize']`,
    );
}

process.on('unhandledRejection', e => {
  console.error('There was an unhandled rejection in this script');
  throw e;
});
