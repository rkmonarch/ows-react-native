const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Force React to always resolve from example/node_modules — prevents the
// "useOws() must be called inside <OwsProvider>" error caused by the npm
// package and the app each loading a different React instance/context.
const exampleModules = path.resolve(projectRoot, 'node_modules');
const DEDUPE = ['react', 'react-native', 'react/jsx-runtime', 'react/jsx-dev-runtime'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (DEDUPE.some((m) => moduleName === m || moduleName.startsWith(m + '/'))) {
    return { filePath: require.resolve(path.join(exampleModules, moduleName)), type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
