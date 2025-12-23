import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DonationsService } from './donations.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { DonationQueryDto } from './dto/donation-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { Donation } from './donation.entity';

@ApiTags('donations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  private sanitizeUser(user: any) {
    if (!user) return user;
    const { passwordHash, transactionPinHash, ...sanitized } = user;
    return sanitized;
  }

  private sanitizeDonationResponse(donation: Donation): any {
    if (!donation) return donation;
    
    const sanitized = { ...donation };
    
    if (sanitized.donor) {
      sanitized.donor = this.sanitizeUser(sanitized.donor);
    }
    
    if (sanitized.beneficiary) {
      sanitized.beneficiary = this.sanitizeUser(sanitized.beneficiary);
    }
    
    return sanitized;
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateDonationDto) {
    const donation = await this.donationsService.createDonation(user, dto);
    return this.sanitizeDonationResponse(donation);
  }

  @Get('count')
  count(@CurrentUser() user: User) {
    return this.donationsService.getDonationCount(user.id);
  }

  @Get()
  async list(@CurrentUser() user: User, @Query() query: DonationQueryDto) {
    const result = await this.donationsService.getDonations(user.id, query);
    return {
      ...result,
      data: result.data.map(donation => this.sanitizeDonationResponse(donation)),
    };
  }

  @Get(':id')
  async getOne(@CurrentUser() user: User, @Param('id') id: string) {
    const donation = await this.donationsService.getDonation(user.id, id);
    return this.sanitizeDonationResponse(donation);
  }

  @Get(':id/transaction')
  getTransaction(@CurrentUser() user: User, @Param('id') id: string) {
    return this.donationsService.getDonationTransaction(user.id, id);
  }
}

