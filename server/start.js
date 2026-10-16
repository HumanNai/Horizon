const { spawn } = require('child_process');
const path = require('path');

// Run web server using Electron runtime as Node so better-sqlite3 and native modules
// share the exact same ABI without requiring any rebuilding between desktop and web versions!
const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
const electronBin = path.join(
  __dirname,
  '..',
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron'
);
const tsxCli = path.join(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const serverEntry = path.join(__dirname, 'index.ts');

const child = spawn(electronBin, [tsxCli, serverEntry], {
  env,
  stdio: 'inherit',
  cwd: path.join(__dirname, '..')
});

child.on('exit', (code) => process.exit(code || 0));
child.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

