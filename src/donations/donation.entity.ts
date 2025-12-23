import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { numericTransformer } from '../shared/numeric.transformer';
import { Transaction } from '../transactions/transaction.entity';

export enum DonationStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('donations')
@Index(['donorId', 'createdAt'])
@Index(['beneficiaryId'])
@Index(['status'])
@Index(['createdAt'])
export class Donation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  donorId: string;

  @Column()
  beneficiaryId: string;

  @ManyToOne(() => User, (user) => user.donationsMade, { 
    onDelete: 'CASCADE',
    lazy: true
  })
  @JoinColumn({ name: 'donorId' })
  donor: User;

  @ManyToOne(() => User, (user) => user.donationsReceived, {
    onDelete: 'CASCADE',
    lazy: true
  })
  @JoinColumn({ name: 'beneficiaryId' })
  beneficiary: User;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  amount: number;

  @Column({ nullable: true })
  message?: string;

  @Column({ type: 'enum', enum: DonationStatus, default: DonationStatus.COMPLETED })
  status: DonationStatus;

  @Column({ nullable: true })
  transactionId?: string;

  @OneToOne(() => Transaction, { 
    cascade: true,
    lazy: true
  })
  @JoinColumn({ name: 'transactionId' })
  transaction?: Transaction;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}