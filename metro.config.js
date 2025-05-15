const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  watchFolders: [],
  resolver: {
    blockList: [
      /android\/build/,
      /android\/app\/build/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);