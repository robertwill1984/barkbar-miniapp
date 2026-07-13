import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator'
import { RefundsService } from './refunds.service'

class CreateRefundDto {
  @IsString()
  @MinLength(1)
  user_id!: string

  @IsIn(['order'])
  source_type!: 'order'

  @IsString()
  @MinLength(1)
  source_id!: string

  @IsString()
  @MinLength(2)
  reason!: string

  @IsOptional()
  @IsArray()
  evidence_file_ids?: string[]
}

class ReviewRefundDto {
  @IsIn(['APPROVE', 'REJECT'])
  action!: 'APPROVE' | 'REJECT'

  @IsOptional()
  @IsString()
  @MinLength(1)
  staff_pin?: string

  @IsOptional()
  @IsString()
  staff_token?: string

  @IsOptional()
  @IsString()
  note?: string
}

@Controller('customer')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Get('refunds')
  list(@Query('user_id') userId: string, @Query('source_id') sourceId?: string) {
    return this.refundsService.list(userId, sourceId)
  }

  @Get('refunds/:refund_id/status')
  status(@Param('refund_id') refundId: string, @Query('user_id') userId: string) {
    return this.refundsService.status(refundId, userId)
  }

  @Post('refunds')
  create(@Body() body: CreateRefundDto) {
    return this.refundsService.create(body)
  }
}

@Controller('admin/refunds')
export class AdminRefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Get()
  adminList(@Query('status') status?: any, @Query('staff_pin') staffPin?: string, @Query('staff_token') staffToken?: string) {
    return this.refundsService.adminList(status, {
      staff_pin: staffPin,
      staff_token: staffToken
    })
  }

  @Post(':refund_id/review')
  review(@Param('refund_id') refundId: string, @Body() body: ReviewRefundDto) {
    return this.refundsService.review(refundId, body)
  }
}
