import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, Min } from 'class-validator';

export class AddMoneyDto {
  @ApiProperty({ description: 'Amount to add to wallet', example: 1000.00, minimum: 0.01 })
  @IsNumber({}, { message: 'Amount must be a number' })
  @IsPositive({ message: 'Amount must be positive' })
  @Min(0.01, { message: 'Amount must be at least 0.01' })
  amount: number;
}

