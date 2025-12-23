import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import {
  Between,
  DataSource,
  Repository,
} from 'typeorm';
import { Donation, DonationStatus } from './donation.entity';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { DonationQueryDto } from './dto/donation-query.dto';
import { User } from '../users/user.entity';
import { Transaction, TransactionType } from '../transactions/transaction.entity';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);

  constructor(
    @InjectRepository(Donation)
    private readonly donationsRepository: Repository<Donation>,
    private readonly usersService: UsersService,
    private readonly walletService: WalletService,
    private readonly transactionsService: TransactionsService,
    private readonly idempotencyService: IdempotencyService,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async createDonation(user: User, dto: CreateDonationDto): Promise<Donation> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const amount = Number(dto.amount);
      if (Number.isNaN(amount) || amount <= 0) {
        throw new BadRequestException('Amount must be positive');
      }

      if (dto.idempotencyKey) {
        const existingKey = await this.idempotencyService.find(dto.idempotencyKey);
        if (existingKey?.donationId) {
          const existingDonation = await queryRunner.manager
            .createQueryBuilder(Donation, 'donation')
            .select([
              'donation.id',
              'donation.donorId',
              'donation.beneficiaryId',
              'donation.amount',
              'donation.message',
              'donation.status',
              'donation.createdAt',
            ])
            .where('donation.id = :id', { id: existingKey.donationId })
            .getOne();

          if (existingDonation) {
            if (queryRunner.isTransactionActive) {
              await queryRunner.rollbackTransaction();
            }
            return existingDonation;
          }
        }
      }

      const donor = await queryRunner.manager.findOne(User, {
        where: { id: user.id },
        lock: { mode: 'pessimistic_write' },
        select: ['id', 'firstName', 'lastName', 'email', 'transactionPinHash'],
      });
      if (!donor) throw new NotFoundException('Donor not found');

      const beneficiary = await queryRunner.manager.findOne(User, {
        where: { id: dto.beneficiaryId },
        select: ['id', 'firstName', 'email'],
      });
      if (!beneficiary) throw new NotFoundException('Beneficiary not found');
      if (beneficiary.id === donor.id) {
        throw new BadRequestException('You cannot donate to yourself');
      }

      const pinValid = await this.usersService.verifyPin(donor, dto.pin);
      if (!pinValid) {
        throw new BadRequestException('Invalid transaction PIN');
      }

      const donorWallet = await this.walletService.getByUserIdWithLock(
        donor.id,
        queryRunner.manager,
      );
      const beneficiaryWallet = await this.walletService.getByUserIdWithLock(
        beneficiary.id,
        queryRunner.manager,
      );

      if (Number(donorWallet.balance) < amount) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      donorWallet.balance = Number(donorWallet.balance) - amount;
      beneficiaryWallet.balance = Number(beneficiaryWallet.balance) + amount;
      await queryRunner.manager.save([donorWallet, beneficiaryWallet]);

      const donation = queryRunner.manager.create(Donation, {
        donorId: donor.id,
        beneficiaryId: beneficiary.id,
        amount,
        message: dto.message ?? undefined,
        status: DonationStatus.COMPLETED,
      });
      await queryRunner.manager.save(donation);

      const transaction = await this.transactionsService.create(
        {
          walletId: donorWallet.id,
          type: TransactionType.DEBIT,
          amount,
          description: `Donation to ${beneficiary.firstName}`,
          donationId: donation.id,
          metadata: {
            beneficiaryId: beneficiary.id,
            beneficiaryEmail: beneficiary.email,
          },
        },
        queryRunner.manager,
      );

      donation.transactionId = transaction.id;
      await queryRunner.manager.save(donation);

      if (dto.idempotencyKey) {
        await this.idempotencyService.create(
          dto.idempotencyKey,
          donor.id,
          donation.id,
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();

      if (process.env.DISABLE_EMAIL !== 'true') {
        await this.cacheManager.del(`donation-count:${donor.id}`);
        await this.cacheManager.del(`wallet:${donor.id}`);
        await this.cacheManager.del(`wallet:${beneficiary.id}`);
        await this.invalidateDonationListCache(donor.id);
      }

      if (process.env.DISABLE_EMAIL !== 'true') {
        this.sendThankYouAsync(donor, beneficiary.id);
      }

      return {
        id: donation.id,
        donorId: donor.id,
        beneficiaryId: beneficiary.id,
        amount,
        message: donation.message,
        status: donation.status,
        transactionId: transaction.id,
        createdAt: donation.createdAt,
      } as Donation;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getDonationCount(
    donorId: string,
    bypassCache = false,
  ): Promise<number> {
    const cacheKey = `donation-count:${donorId}`;
    
    if (!bypassCache) {
      const cached = await this.cacheManager.get<number>(cacheKey);
      if (cached !== undefined && cached !== null) {
        return cached;
      }
    }

    const count = await this.donationsRepository
      .createQueryBuilder('donation')
      .where('donation.donorId = :donorId', { donorId })
      .getCount();

    await this.cacheManager.set(cacheKey, count, 60000);
    return count;
  }

  async getDonations(
    donorId: string,
    query: DonationQueryDto,
  ): Promise<{
    data: Donation[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const { page = 1, limit = 20, startDate, endDate } = query;

    const cacheKey = `donations:${donorId}:${startDate || 'all'}:${endDate || 'all'}:${page}:${limit}`;
    const cached = await this.cacheManager.get<{
      data: Donation[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(cacheKey);
    if (cached) return cached;

    const skip = (page - 1) * limit;
    let qb = this.donationsRepository
      .createQueryBuilder('donation')
      .select([
        'donation.id',
        'donation.donorId',
        'donation.beneficiaryId',
        'donation.amount',
        'donation.message',
        'donation.status',
        'donation.createdAt',
      ])
      .where('donation.donorId = :donorId', { donorId });

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      qb = qb.andWhere(
        'donation.createdAt BETWEEN :start AND :end',
        { start, end },
      );
    }

    qb = qb
      .orderBy('donation.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    const payload = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cacheManager.set(cacheKey, payload, 60000);
    return payload;
  }

  async getDonation(donorId: string, id: string): Promise<Donation> {
    const donation = await this.donationsRepository
      .createQueryBuilder('donation')
      .select([
        'donation.id',
        'donation.donorId',
        'donation.beneficiaryId',
        'donation.amount',
        'donation.message',
        'donation.status',
        'donation.transactionId',
        'donation.createdAt',
      ])
      .where('donation.id = :id', { id })
      .andWhere('donation.donorId = :donorId', { donorId })
      .getOne();

    if (!donation) throw new NotFoundException('Donation not found');
    return donation;
  }

  async getDonationTransaction(
    donorId: string,
    donationId: string,
  ): Promise<Transaction> {
    const donation = await this.donationsRepository
      .createQueryBuilder('donation')
      .select(['donation.id', 'donation.transactionId'])
      .where('donation.id = :id', { id: donationId })
      .andWhere('donation.donorId = :donorId', { donorId })
      .getOne();

    if (!donation || !donation.transactionId) {
      throw new NotFoundException('Donation or transaction not found');
    }

    const transaction = await this.transactionsService.findByDonationId(
      donation.id,
    );

    if (!transaction) {
      throw new NotFoundException('Transaction not found for donation');
    }

    return transaction;
  }

  private async invalidateDonationListCache(donorId: string): Promise<void> {
    const cachePatterns = [
      `donations:${donorId}:all:all:1:20`,
      `donations:${donorId}:all:all:1:50`,
    ];

    for (const pattern of cachePatterns) {
      await this.cacheManager.del(pattern).catch(() => {});
    }
  }

  private async sendThankYouAsync(
    donor: User,
    beneficiaryId: string,
  ): Promise<void> {
    setImmediate(async () => {
      try {
        const donationCount = await this.getDonationCount(donor.id, true);
        if (donationCount >= 2) {
          await this.emailService.sendThankYou(
            donor.email,
            donor.firstName,
            donationCount,
          );
        }
      } catch (err) {
        this.logger.error(
          'Failed to send thank-you email (non-blocking)',
          err,
        );
      }
    });
  }
}