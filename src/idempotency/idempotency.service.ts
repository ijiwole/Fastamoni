import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { IdempotencyKey } from './idempotency-key.entity';

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  async find(key: string): Promise<IdempotencyKey | null> {
    return this.repo.findOne({
      where: { key },
      relations: ['donation'],
    });
  }

  async create(
    key: string,
    userId: string,
    donationId?: string,
    manager?: EntityManager,
  ): Promise<IdempotencyKey> {
    const repository = manager ? manager.getRepository(IdempotencyKey) : this.repo;
    const entry = repository.create({ key, userId, donationId });
    return repository.save(entry);
  }
}

