module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    ['module:react-native-dotenv', {
      moduleName: '@env',
      path: '.env',
      allowlist: [
        'API_URL',
        'TRUELAYER_CLIENT_ID',
        'TRUELAYER_CLIENT_SECRET', 
        'TRUELAYER_REDIRECT_URI',
        'FIREBASE_WEB_API_KEY',
        'DEVELOPMENT_ENCRYPTION_KEY',
        'TRUELAYER_PRIVATE_KEY_ID',
        'TRUELAYER_PRIVATE_KEY',
        'GOOGLE_GEMINI_API_KEY'
      ],
      safe: false,
      allowUndefined: true,
    }],
    'react-native-reanimated/plugin',
  ],
};