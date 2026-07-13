import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { IsOptional, IsString, MinLength } from 'class-validator'
import { AgreementsService } from './agreements.service'

class AcceptAgreementDto {
  @IsString()
  @MinLength(1)
  user_id!: string

  @IsOptional()
  @IsString()
  pet_id?: string

  @IsString()
  @MinLength(1)
  checkbox_text!: string

  @IsOptional()
  @IsString()
  user_agent?: string
}

@Controller('customer/agreements')
export class AgreementsController {
  constructor(private readonly agreementsService: AgreementsService) {}

  @Get('required')
  required(@Query('user_id') userId: string) {
    return this.agreementsService.required(userId)
  }

  @Post(':agreement_id/accept')
  accept(@Param('agreement_id') agreementId: string, @Body() body: AcceptAgreementDto) {
    return this.agreementsService.accept(agreementId, body)
  }
}
