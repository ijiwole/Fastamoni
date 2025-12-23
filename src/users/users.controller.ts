import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SetPinDto, ResetPinDto } from './dto/set-pin.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from './user.entity';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: User) {
    const { passwordHash, transactionPinHash, ...safeUser } = user;
    return safeUser;
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('pin')
  async setPin(@CurrentUser() user: User, @Body() dto: SetPinDto) {
    const updated = await this.usersService.setTransactionPin(user.id, dto.pin);
    return { message: 'PIN created successfully' };
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('pin/reset')
  async resetPin(@CurrentUser() user: User, @Body() dto: ResetPinDto) {
    await this.usersService.resetTransactionPin(user.id, dto.oldPin, dto.newPin);
    return { message: 'PIN reset successfully' };
  }
}

