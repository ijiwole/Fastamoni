import { ConfigService } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { User } from '../users/user.entity';
import { Wallet } from '../wallet/wallet.entity';
import { Donation } from '../donations/donation.entity';
import { Transaction } from '../transactions/transaction.entity';
import { IdempotencyKey } from '../idempotency/idempotency-key.entity';

export const typeOrmConfig = (
  configService: ConfigService,
): DataSourceOptions => {
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const poolMax = Number(configService.get<string>('DB_POOL_MAX', '20'));
  const idleTimeoutMillis = Number(
    configService.get<string>('DB_POOL_IDLE_TIMEOUT_MS', '30000'),
  );
  const connectionTimeoutMillis = Number(
    configService.get<string>('DB_POOL_CONNECTION_TIMEOUT_MS', '2000'),
  );
  
  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST', '127.0.0.1'),
    port: Number(configService.get<string>('DB_PORT', '5432')),
    username: configService.get<string>('DB_USER', 'postgres'),
    password: configService.get<string>('DB_PASSWORD', 'postgres'),
    database: configService.get<string>('DB_NAME', 'fastamoni'),
    entities: [User, Wallet, Donation, Transaction, IdempotencyKey],
    synchronize: !isProduction,
    migrations: isProduction ? ['dist/migrations/*.js'] : undefined,
    migrationsRun: isProduction,
    logging: false,
    extra: {
      application_name: 'fastamoni-service',
      // Set timezone to UTC for PostgreSQL connection
      options: '-c timezone=UTC',
      // pg Pool settings (node-postgres). Helps handle higher rps by allowing
      // more concurrent DB work without connection thrash.
      max: Number.isFinite(poolMax) ? poolMax : 20,
      idleTimeoutMillis: Number.isFinite(idleTimeoutMillis)
        ? idleTimeoutMillis
        : 30000,
      connectionTimeoutMillis: Number.isFinite(connectionTimeoutMillis)
        ? connectionTimeoutMillis
        : 2000,
      keepAlive: true,
    },
  };
};
