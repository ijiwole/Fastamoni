import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: '6-digit verification code sent to email' })
  @IsString()
  @Length(6, 6)
  @Matches(/^[0-9]{6}$/, { message: 'Verification code must be 6 digits' })
  code: string;
}

