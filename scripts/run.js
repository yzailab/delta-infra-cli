#!/usr/bin/env node
const path = require('path');
const { spawn } = require('child_process');

const platform = process.platform === 'win32' ? 'windows' : process.platform;
const ext = platform === 'windows' ? '.exe' : '';
const binary = path.join(__dirname, '..', 'bin', `delta-cli${ext}`);

const child = spawn(binary, process.argv.slice(2), {
  stdio: 'inherit',
  windowsHide: true,
});

child.on('error', (err) => {
  console.error('Failed to start delta-cli:', err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
