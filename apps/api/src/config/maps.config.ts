import { registerAs } from '@nestjs/config';

export default registerAs('maps', () => ({
  apiKey: process.env.GOOGLE_MAPS_API_KEY,
  valhallaUrl: process.env.VALHALLA_URL || 'http://localhost:8002',
  defaultRegionCode: process.env.PLACES_REGION_CODE || 'KE',
  requestTimeoutMs: parseInt(process.env.MAPS_REQUEST_TIMEOUT_MS || '8000', 10),
}));
