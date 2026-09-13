/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.horizon.pm',
  productName: 'Horizon',
  copyright: 'Copyright © 2024-2026 Horizon Contributors',
  npmRebuild: false,
  publish: null,
  // Skip code signing — not needed for internal portable builds
  // Set CSC_IDENTITY_AUTO_DISCOVERY=false to suppress winCodeSign download
  compression: 'maximum',
  electronLanguages: ['en-US', 'en'],
  directories: {
    buildResources: 'build',
    output: 'release'
  },
  files: [
    'out/**',
    'images/**',
    'node_modules/**'
  ],
  win: {
    icon: 'build/icon.ico',
    target: [
      {
        target: 'nsis',
        arch: ['x64']
      },
      {
        target: 'portable',
        arch: ['x64']
      }
    ],
    signingHashAlgorithms: null,
    sign: null
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
    installerIcon: 'build/icon.ico',
    uninstallerIcon: 'build/icon.ico',
    artifactName: 'Horizon-Setup-${version}.exe'
  },
  portable: {
    artifactName: 'Horizon-${version}-portable.exe',
    requestExecutionLevel: 'user',
    unpackDirName: 'HorizonPM'
  },
  mac: {
    icon: 'build/icon.png',
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64']
      }
    ],
    category: 'public.app-category.productivity',
    darkModeSupport: true,
    hardenedRuntime: false,
    gatekeeperAssess: false,
    identity: null,
    artifactName: 'Horizon-${version}-mac-${arch}.${ext}'
  },
  afterPack: async (context) => {
    if (context.electronPlatformName === 'darwin' && process.platform === 'darwin') {
      const { execSync } = require('child_process');
      const path = require('path');
      const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
      const entitlementsPath = path.join(context.packager.projectDir, 'build', 'entitlements.mac.plist');

      console.log(`[Horizon] Applying ad-hoc codesign with entitlements to: ${appPath}`);
      try {
        try { execSync(`xattr -cr "${appPath}"`, { stdio: 'ignore' }); } catch (_) {}
        execSync(`codesign --force --deep --sign - --entitlements "${entitlementsPath}" "${appPath}"`, { stdio: 'inherit' });
        execSync(`codesign --verify --deep --strict --verbose=2 "${appPath}"`, { stdio: 'inherit' });
        console.log(`[Horizon] Ad-hoc codesign completed successfully.`);
      } catch (err) {
        console.warn(`[Horizon] Codesign warning: ${err.message}`);
      }
    }
  },
  dmg: {
    contents: [
      {
        x: 130,
        y: 220
      },
      {
        x: 410,
        y: 220,
        type: 'link',
        path: '/Applications'
      }
    ],
    window: {
      width: 540,
      height: 380
    }
  },
  asar: true,
  asarUnpack: [
    '**/node_modules/better-sqlite3/**',
    '**/node_modules/bcrypt/**'
  ]
}


