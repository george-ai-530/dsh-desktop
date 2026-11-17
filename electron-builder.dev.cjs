const packageJson = require('./package.json')

module.exports = {
  ...packageJson.build,
  appId: 'io.dsh.desktop.dev',
  productName: 'COWIN Harness Desktop Dev',
  directories: {
    ...packageJson.build.directories,
    output: 'dist-dev'
  },
  extraMetadata: {
    name: 'dsh-desktop-dev',
    productName: 'COWIN Harness Desktop Dev',
    dshDesktopChannel: 'development'
  },
  artifactName: 'cowin-harness-desktop-dev-${os}-${arch}.${ext}',
  linux: {
    ...packageJson.build.linux,
    executableName: 'dsh-desktop-dev',
    artifactName: 'cowin-harness-desktop-dev-linux-${arch}-${version}.${ext}'
  },
  nsis: {
    ...packageJson.build.nsis,
    artifactName: 'cowin-harness-desktop-dev-windows-${arch}-setup.${ext}'
  },
  publish: null
}
