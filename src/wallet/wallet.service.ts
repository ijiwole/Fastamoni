import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindOneOptions,
  Repository,
} from 'typeorm';
import { Wallet } from './wallet.entity';
import { Cache } from 'cache-manager';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async createForUser(
    userId: string,
    manager?: EntityManager,
  ): Promise<Wallet> {
    const repo = manager
      ? manager.getRepository(Wallet)
      : this.walletRepository;
    const wallet = repo.create({ userId, balance: 0 });
    return repo.save(wallet);
  }

  async getWalletByUserId(userId: string) {
    const cacheKey = `wallet:${userId}`;

    // Check cache first
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const wallet = await this.walletRepository
      .createQueryBuilder('wallet')
      .select(['wallet.id', 'wallet.userId', 'wallet.balance', 'wallet.createdAt', 'wallet.updatedAt'])
      .where('wallet.userId = :userId', { userId })
      .getOne();

    if (wallet) {
      await this.cacheManager.set(cacheKey, wallet, 120000);
    }

    return wallet;
  }

  async getByUserIdWithLock(
    userId: string,
    manager: EntityManager,
    lockMode: 'pessimistic_read' | 'pessimistic_write' = 'pessimistic_write',
  ): Promise<Wallet> {
    const wallet = await manager.findOne(Wallet, {
      where: { userId },
      lock: { mode: lockMode },
    });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return wallet;
  }
}

