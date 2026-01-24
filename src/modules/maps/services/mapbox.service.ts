import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MapboxClient from '@mapbox/mapbox-sdk';
import { RedisService } from '../../../shared/redis/redis.service';
import { MapboxError, CacheOptions } from '../interfaces/mapbox.interface';

export class MapboxApiException extends Error {
  constructor(
    public readonly originalError: any,
    public readonly type: MapboxError['type'] = 'Unknown'
  ) {
    super(originalError.message || 'Mapbox API error');
    this.name = 'MapboxApiException';
  }
}

@Injectable()
export class MapboxService {
  private readonly logger = new Logger(MapboxService.name);
  private readonly mapboxClient: MapboxClient;
  private readonly config: {
    accessToken: string;
    baseUrl: string;
    cacheEnabled: boolean;
    cacheTTL: Record<string, number>;
    rateLimits: Record<string, number>;
    retryConfig: {
      maxRetries: number;
      baseDelay: number;
    };
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {
    const mapsConfig = this.configService.get('maps');
    this.config = {
      accessToken: mapsConfig?.mapboxAccessToken || process.env.MAPBOX_ACCESS_TOKEN || '',
      baseUrl: mapsConfig?.mapboxBaseUrl || 'https://api.mapbox.com',
      cacheEnabled: mapsConfig?.cacheEnabled ?? false,
      cacheTTL: mapsConfig?.cacheTTL || {},
      rateLimits: mapsConfig?.rateLimits || {},
      retryConfig: mapsConfig?.retryConfig || { maxRetries: 3, baseDelay: 1000 }
    };
    
    if (!this.config.accessToken) {
      throw new Error('MAPBOX_ACCESS_TOKEN is required');
    }

    this.mapboxClient = MapboxClient({
      accessToken: this.config.accessToken,
      origin: this.config.baseUrl
    });

    this.logger.log('Mapbox service initialized successfully');
  }

  async makeRequest<T>(
    apiCall: () => Promise<any>,
    cacheOptions?: CacheOptions,
    serviceType: string = 'general'
  ): Promise<T> {
    // Check rate limits
    await this.checkRateLimit(serviceType);

    // Check cache first
    if (cacheOptions?.enabled && cacheOptions.key) {
      const cached = await this.getCachedResult<T>(cacheOptions.key);
      if (cached) {
        this.logger.debug(`Cache hit for key: ${cacheOptions.key}`);
        return cached;
      }
    }

    try {
      const result = await this.retryRequest(apiCall);
      
      // Cache successful responses
      if (cacheOptions?.enabled && cacheOptions.key && result) {
        await this.setCachedResult(cacheOptions.key, result, cacheOptions.ttl);
        this.logger.debug(`Cached result for key: ${cacheOptions.key}`);
      }

      // Track usage
      await this.trackUsage(serviceType, true);
      
      return result;
    } catch (error) {
      await this.trackUsage(serviceType, false);
      throw this.handleMapboxError(error);
    }
  }

  private async retryRequest<T>(
    apiCall: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await apiCall();
    } catch (error) {
      if (attempt >= this.config.retryConfig.maxRetries) {
        throw error;
      }

      // Check if error is retryable
      if (this.isRetryableError(error)) {
        const delay = Math.pow(2, attempt) * this.config.retryConfig.baseDelay;
        this.logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt}/${this.config.retryConfig.maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.retryRequest(apiCall, attempt + 1);
      }

      throw error;
    }
  }

  private isRetryableError(error: any): boolean {
    // Retry on network errors, timeouts, and 5xx status codes
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    if (error.response?.status >= 500) {
      return true;
    }
    
    // Retry on rate limiting (after delay)
    if (error.response?.status === 429) {
      return true;
    }
    
    return false;
  }

  private handleMapboxError(error: any): MapboxApiException {
    this.logger.error('Mapbox API error:', error.message);
    
    if (error.response?.status) {
      switch (error.response.status) {
        case 401:
          return new MapboxApiException(error, 'Unauthorized');
        case 404:
          return new MapboxApiException(error, 'ProfileNotFound');
        case 422:
          return new MapboxApiException(error, 'InvalidInput');
        case 429:
          return new MapboxApiException(error, 'RateLimited');
        default:
          return new MapboxApiException(error, 'Unknown');
      }
    }

    // Check for specific Mapbox error types
    if (error.message?.includes('No route found')) {
      return new MapboxApiException(error, 'NoRoute');
    }
    
    if (error.message?.includes('No segment')) {
      return new MapboxApiException(error, 'NoSegment');
    }

    return new MapboxApiException(error, 'Unknown');
  }

  private async getCachedResult<T>(key: string): Promise<T | null> {
    if (!this.config.cacheEnabled) {
      return null;
    }

    try {
      return await this.redisService.get(key);
    } catch (error) {
      this.logger.warn('Cache read error:', error.message);
      return null;
    }
  }

  private async setCachedResult<T>(key: string, value: T, ttl: number): Promise<void> {
    if (!this.config.cacheEnabled) {
      return;
    }

    try {
      await this.redisService.set(key, value, ttl);
    } catch (error) {
      this.logger.warn('Cache write error:', error.message);
    }
  }

  private async checkRateLimit(serviceType: string): Promise<void> {
    const limit = this.config.rateLimits[serviceType];
    if (!limit) return;

    const key = `ratelimit:${serviceType}:${this.getCurrentMinute()}`;
    const current = (await this.redisService.get<number>(key)) || 0;
    
    if (current >= limit) {
      throw new MapboxApiException(
        new Error(`Rate limit exceeded for ${serviceType}: ${current}/${limit} requests per minute`),
        'RateLimited'
      );
    }
    
    await this.redisService.set(key, current + 1, 60);
  }

  private async trackUsage(serviceType: string, success: boolean): Promise<void> {
    const key = `usage:${serviceType}:${this.getCurrentHour()}`;
    const stats = await this.redisService.get<{
      requests: number;
      errors: number;
      cacheHits: number;
    }>(key) || {
      requests: 0,
      errors: 0,
      cacheHits: 0
    };
    
    stats.requests += 1;
    if (!success) {
      stats.errors += 1;
    }
    
    await this.redisService.set(key, stats, 3600); // 1 hour TTL
  }

  private getCurrentMinute(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
  }

  private getCurrentHour(): string {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
  }

  async getUsageStats(): Promise<any> {
    const now = new Date();
    const stats = {
      geocoding: { requests: 0, errors: 0, cacheHits: 0 },
      routing: { requests: 0, errors: 0, cacheHits: 0 },
      matrix: { requests: 0, errors: 0, cacheHits: 0 },
      navigation: { requests: 0, errors: 0, cacheHits: 0 },
    };

    // Aggregate last 24 hours of usage
    for (let i = 0; i < 24; i++) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourKey = `${hour.getFullYear()}-${hour.getMonth()}-${hour.getDate()}-${hour.getHours()}`;
      
      for (const service of Object.keys(stats)) {
        const key = `usage:${service}:${hourKey}`;
        const hourStats = await this.redisService.get<{
          requests: number;
          errors: number;
          cacheHits: number;
        }>(key);
        if (hourStats) {
          stats[service].requests += hourStats.requests || 0;
          stats[service].errors += hourStats.errors || 0;
          stats[service].cacheHits += hourStats.cacheHits || 0;
        }
      }
    }

    return stats;
  }

  hashQuery(query: string, options?: any): string {
    const crypto = require('crypto');
    const data = JSON.stringify({ query, options });
    return crypto.createHash('md5').update(data).digest('hex');
  }

  hashCoordinates(coords: [number, number][], options?: any): string {
    const crypto = require('crypto');
    const data = JSON.stringify({ coords, options });
    return crypto.createHash('md5').update(data).digest('hex');
  }

  chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  get client(): MapboxClient {
    return this.mapboxClient;
  }
}