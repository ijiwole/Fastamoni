import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly walletService: WalletService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const email = dto.email.toLowerCase();
    
    const existing = await this.usersRepository
      .createQueryBuilder('user')
      .select(['user.id'])
      .where('user.email = :email', { email })
      .getOne();

    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email,
        passwordHash,
      });
      const saved = await manager.save(user);
      await this.walletService.createForUser(saved.id, manager);
      return saved;
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const lowerEmail = email.toLowerCase();
    const cacheKey = `user:email:${lowerEmail}`;

    const cached = await this.cacheManager.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.usersRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.email',
        'user.passwordHash',
        'user.isEmailVerified',
        'user.createdAt',
      ])
      .where('user.email = :email', { email: lowerEmail })
      .getOne();

    if (user) {
      await this.cacheManager.set(cacheKey, user, 300000);
    }

    return user || null;
  }

  async findById(id: string): Promise<User | null> {
    const cacheKey = `user:id:${id}`;

    const cached = await this.cacheManager.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.usersRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.firstName',
        'user.lastName',
        'user.email',
        'user.transactionPinHash',
        'user.isEmailVerified',
        'user.createdAt',
      ])
      .where('user.id = :id', { id })
      .getOne();

    if (user) {
      await this.cacheManager.set(cacheKey, user, 300000);
    }

    return user || null;
  }

  async findByIdForAuth(id: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.passwordHash',
        'user.transactionPinHash',
        'user.isEmailVerified',
      ])
      .where('user.id = :id', { id })
      .getOne();
  }

  async setTransactionPin(userId: string, pin: string): Promise<User> {
    const user = await this.findByIdOrFail(userId);
    const hash = await bcrypt.hash(pin, 10);

    await this.usersRepository
      .createQueryBuilder()
      .update(User)
      .set({ transactionPinHash: hash })
      .where('id = :id', { id: userId })
      .execute();

    await this.invalidateUserCache(userId);
    user.transactionPinHash = hash;
    return user;
  }

  async resetTransactionPin(
    userId: string,
    oldPin: string,
    newPin: string,
  ): Promise<void> {
    const user = await this.findByIdOrFail(userId);

    if (!user.transactionPinHash) {
      throw new BadRequestException('No PIN set. Use /pin endpoint to create one.');
    }

    const isValidOldPin = await this.verifyPin(user, oldPin);
    if (!isValidOldPin) {
      throw new BadRequestException('Old PIN is incorrect');
    }

    const hash = await bcrypt.hash(newPin, 10);

    await this.usersRepository
      .createQueryBuilder()
      .update(User)
      .set({ transactionPinHash: hash })
      .where('id = :id', { id: userId })
      .execute();

    await this.invalidateUserCache(userId);
  }

  async verifyPin(user: User, pin: string): Promise<boolean> {
    if (!user.transactionPinHash) return false;
    return bcrypt.compare(pin, user.transactionPinHash);
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async generateEmailVerificationCode(userId: string): Promise<string> {
    const user = await this.findByIdOrFail(userId);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await this.usersRepository
      .createQueryBuilder()
      .update(User)
      .set({
        emailVerificationCode: code,
        emailVerificationCodeExpires: expiresAt,
      })
      .where('id = :id', { id: userId })
      .execute();

    await this.invalidateUserCache(userId);
    return code;
  }

  async verifyEmailCode(userId: string, code: string): Promise<boolean> {
    const normalizedCode = (code ?? '').replace(/\s+/g, '').trim();
    if (!normalizedCode) return false;

    const user = await this.usersRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.emailVerificationCode', 'user.emailVerificationCodeExpires'])
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.emailVerificationCode || !user.emailVerificationCodeExpires) {
      return false;
    }

    if (user.emailVerificationCode !== normalizedCode) {
      return false;
    }

    if (new Date() > user.emailVerificationCodeExpires) {
      await this.usersRepository
        .createQueryBuilder()
        .update(User)
        .set({
          emailVerificationCode: null,
          emailVerificationCodeExpires: null,
        })
        .where('id = :id', { id: userId })
        .execute();

      await this.invalidateUserCache(userId);
      return false;
    }

    await this.usersRepository
      .createQueryBuilder()
      .update(User)
      .set({
        isEmailVerified: true,
        emailVerificationCode: null,
        emailVerificationCodeExpires: null,
      })
      .where('id = :id', { id: userId })
      .execute();

    await this.invalidateUserCache(userId);
    return true;
  }

  private async invalidateUserCache(userId: string): Promise<void> {
    await this.cacheManager.del(`user:id:${userId}`);
  }

  private async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}