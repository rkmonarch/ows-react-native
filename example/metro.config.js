const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Allow Metro to resolve the library source from the parent directory
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// CRITICAL: Force React/React Native to always resolve from example/node_modules.
// Without this, files in src/ (parent dir) pull React from the root node_modules,
// creating two React instances → Invalid hook call crash.
const exampleNodeModules = path.resolve(projectRoot, 'node_modules');
const FORCE_SINGLE_COPY = ['react', 'react-native', 'react/jsx-runtime', 'react/jsx-dev-runtime'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (FORCE_SINGLE_COPY.some((m) => moduleName === m || moduleName.startsWith(m + '/'))) {
    // Re-resolve with the origin forced to inside example/ so it always
    // picks up example/node_modules/react instead of root node_modules/react
    const resolved = path.resolve(exampleNodeModules, moduleName);
    return { filePath: require.resolve(resolved), type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
