import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Transaction, TransactionType } from './transaction.entity';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly repo: Repository<Transaction>,
    private readonly walletService: WalletService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(
    data: Partial<Transaction>,
    manager?: EntityManager,
  ): Promise<Transaction> {
    const repository = manager ? manager.getRepository(Transaction) : this.repo;
    const record = repository.create(data);
    return repository.save(record);
  }

  async findByDonationId(donationId: string): Promise<Transaction | null> {
    return this.repo.findOne({ where: { donationId } });
  }

  async addMoneyToWallet(userId: string, amount: number): Promise<{ message: string; balance: number }> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock wallet for update to prevent race conditions
      const wallet = await this.walletService.getByUserIdWithLock(
        userId,
        queryRunner.manager,
        'pessimistic_write',
      );

      // Update wallet balance
      wallet.balance = Number(wallet.balance) + amount;
      await queryRunner.manager.save(wallet);

      // Create transaction record
      await this.create(
        {
          walletId: wallet.id,
          type: TransactionType.CREDIT,
          amount,
          description: 'Funds added to wallet',
          metadata: {
            source: 'manual',
          },
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      await this.cacheManager.del(`wallet:${userId}`);

      return {
        message: 'Funds added to wallet successfully',
        balance: Number(wallet.balance),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

