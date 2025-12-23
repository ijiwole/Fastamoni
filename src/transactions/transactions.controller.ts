import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { AddMoneyDto } from './dto/add-money.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('fund-wallet')
  @ApiOperation({ summary: 'Add money to wallet' })
  @ApiResponse({ status: 201, description: 'Money added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid amount' })
  async addMoney(@CurrentUser() user: User, @Body() dto: AddMoneyDto) {
    return this.transactionsService.addMoneyToWallet(user.id, dto.amount);
  }
}

