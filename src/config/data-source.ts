import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../users/user.entity';
import { Wallet } from '../wallet/wallet.entity';
import { Donation } from '../donations/donation.entity';
import { Transaction } from '../transactions/transaction.entity';
import { IdempotencyKey } from '../idempotency/idempotency-key.entity';

// Load environment variables
config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'fastamoni',
  entities: [User, Wallet, Donation, Transaction, IdempotencyKey],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: true,
});

