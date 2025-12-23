import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateDonationDto {
  @ApiProperty()
  @IsUUID()
  beneficiaryId: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({ description: 'Transaction PIN to authorize the donation' })
  @IsString()
  @Matches(/^[0-9]{4,6}$/)
  pin: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    description: 'Idempotency key to avoid duplicate donations. Generate a unique UUID on the client side before making the request. If the same key is used in a retry, the original donation will be returned instead of creating a duplicate.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

