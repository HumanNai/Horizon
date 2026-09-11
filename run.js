const { spawn } = require('child_process');
const path = require('path');

// Clean up any Electron-as-node override flags inherited from IDE/VSCode terminals
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const isDev = process.argv.includes('--dev');
const electronBin = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');

if (isDev) {
  // Launch electron-vite dev with the clean environment
  const child = spawn('cmd.exe', ['/c', 'npx', 'electron-vite', 'dev'], {
    env,
    stdio: 'inherit',
    cwd: __dirname
  });
  child.on('exit', code => process.exit(code || 0));
} else {
  // Launch the Electron application directly
  const child = spawn(electronBin, ['.'], {
    env,
    stdio: 'inherit',
    cwd: __dirname
  });
  const exitHandler = (code) => process.exit(code || 0);
  child.on('exit', exitHandler);
  child.on('close', exitHandler);
}

