import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Wallet } from '../wallet/wallet.entity';
import { Donation } from '../donations/donation.entity';

@Entity('users')
// OPTIMIZATION: Add index on createdAt for sorting/filtering
@Index(['createdAt'])
// OPTIMIZATION: Add index on isEmailVerified for query filtering
@Index(['isEmailVerified'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 80 })
  firstName: string;

  @Column({ length: 80 })
  lastName: string;

  @Index({ unique: true })
  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar' })
  passwordHash: string;

  @Column({ type: 'varchar', nullable: true })
  transactionPinHash?: string | null;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', length: 6, nullable: true })
  emailVerificationCode?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerificationCodeExpires?: Date | null;

  // OPTIMIZATION: Avoid eager loading relations by default
  // Load them explicitly only when needed
  @OneToOne(() => Wallet, (wallet) => wallet.user, { lazy: true })
  wallet: Wallet;

  // OPTIMIZATION: These should NOT be eagerly loaded in most queries
  @OneToMany(() => Donation, (donation) => donation.donor, { lazy: true })
  donationsMade: Donation[];

  @OneToMany(() => Donation, (donation) => donation.beneficiary, { lazy: true })
  donationsReceived: Donation[];

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}