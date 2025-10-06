#!/usr/bin/env node

import { Command } from 'commander';
import ruleImporterCommand from './rule-importer.js';
import dbManagerCommand from './db-manager.js';
import httpClientCommand from './http-client.js';

const program = new Command();

program
    .name('aiguibin-toolkit')
    .description('A comprehensive toolkit for database operations and HTTP requests')
    .version('1.0.0');

// 注册子命令
program.addCommand(ruleImporterCommand);
program.addCommand(dbManagerCommand);
program.addCommand(httpClientCommand);

program.parse(process.argv);