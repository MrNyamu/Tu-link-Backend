import { registerAs } from '@nestjs/config';

export default registerAs('maps', () => ({
  mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN,
  mapboxBaseUrl: process.env.MAPBOX_BASE_URL || 'https://api.mapbox.com',
  cacheEnabled: process.env.MAPS_CACHE_ENABLED === 'true',
  cacheTTL: {
    geocoding: parseInt(process.env.GEOCODING_CACHE_TTL || '86400'), // 24 hours
    routing: parseInt(process.env.ROUTING_CACHE_TTL || '1800'),     // 30 minutes
    matrix: parseInt(process.env.MATRIX_CACHE_TTL || '900'),        // 15 minutes
    navigation: parseInt(process.env.NAVIGATION_CACHE_TTL || '3600'), // 1 hour
  },
  rateLimits: {
    geocoding: parseInt(process.env.GEOCODING_RATE_LIMIT || '600'),   // requests per minute
    routing: parseInt(process.env.ROUTING_RATE_LIMIT || '300'),      // requests per minute
    matrix: parseInt(process.env.MATRIX_RATE_LIMIT || '120'),        // requests per minute
  },
  retryConfig: {
    maxRetries: parseInt(process.env.MAPS_MAX_RETRIES || '3'),
    baseDelay: parseInt(process.env.MAPS_RETRY_DELAY || '1000'),     // milliseconds
  },
}));
