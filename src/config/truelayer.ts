import { API_URL, TRUELAYER_CLIENT_ID, TRUELAYER_CLIENT_SECRET, TRUELAYER_REDIRECT_URI } from '@env';

export const trueLayerConfig = {
  apiUrl: API_URL,
  clientId: TRUELAYER_CLIENT_ID,
  clientSecret: TRUELAYER_CLIENT_SECRET,
  redirectUri: TRUELAYER_REDIRECT_URI,
  environment: 'sandbox', // Use truelayer sandbox
};