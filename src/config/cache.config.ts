import { CacheModuleOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';

export const cacheConfig = async (
  configService: ConfigService,
): Promise<CacheModuleOptions> => {
  const host = configService.get<string>('REDIS_HOST', '127.0.0.1');
  const port = Number(configService.get<string>('REDIS_PORT', '6379'));
  const password = configService.get<string>('REDIS_PASSWORD');

  return {
    store: await redisStore({
      host,
      port,
      password,
      ttl: 60, // seconds
    }),
    ttl: 60,
    max: 1000,
  };
};
