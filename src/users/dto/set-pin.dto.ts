import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class SetPinDto {
  @ApiProperty({ description: '4-6 digit numeric pin' })
  @IsString()
  @Length(4, 6)
  @Matches(/^[0-9]+$/, { message: 'PIN must be numeric' })
  pin: string;
}

export class ResetPinDto {
  @ApiProperty({ description: 'Old 4-6 digit numeric pin' })
  @IsString()
  @Length(4, 6)
  @Matches(/^[0-9]+$/, { message: 'PIN must be numeric' })
  oldPin: string;

  @ApiProperty({ description: 'New 4-6 digit numeric pin' })
  @IsString()
  @Length(4, 6)
  @Matches(/^[0-9]+$/, { message: 'PIN must be numeric' })
  newPin: string;
}

