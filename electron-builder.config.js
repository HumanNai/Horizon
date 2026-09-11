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
  asar: true,
  asarUnpack: [
    '**/node_modules/better-sqlite3/**',
    '**/node_modules/bcrypt/**'
  ]
}


