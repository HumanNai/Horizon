/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.horizon.pm',
  productName: 'Horizon',
  copyright: 'Copyright © 2024 Horizon PM',
  npmRebuild: false,
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


