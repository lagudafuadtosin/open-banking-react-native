const express = require('express');
const tlSigning = require('truelayer-signing');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

app.post('/api/truelayer-request', async (req, res) => {
  console.log('Request received:', req.method, req.url);
  console.log('Request body keys:', Object.keys(req.body || {}));

  try {
    const { url, method, headers, body, idempotencyKey } = req.body;

    console.log('Extracted data:');
    console.log('- URL:', url);
    console.log('- Method:', method);
    console.log('- IdempotencyKey:', idempotencyKey);
    console.log('- Headers:', headers);

    const requestHeaders = {
      ...headers,
      'Idempotency-Key': idempotencyKey,
    };

    console.log('About to generate signature...');

    const signature = tlSigning.sign({
      kid: process.env.TRUELAYER_PRIVATE_KEY_ID,
      privateKeyPem: process.env.TRUELAYER_PRIVATE_KEY,
      method,
      path: new URL(url).pathname,
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(body) || '',
    });

    console.log('Signature generated successfully');

    const response = await axios({
      method,
      url,
      headers: {
        ...requestHeaders,
        'Tl-Signature': signature,
      },
      data: body,
    });

    console.log('TrueLayer response received:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('TrueLayer API Error:');
    console.error('- Status:', error.response?.status || 'Unknown');
    console.error('- Message:', error.response?.data?.detail || error.message);
    console.error('- Errors:', error.response?.data?.errors || 'No specific errors provided');

    res.status(error.response?.status || 500).json({
      error: error.response?.data || { message: error.message }
    });
  }
});

app.listen(3000, '0.0.0.0', () => console.log('Server running on port 3000'));