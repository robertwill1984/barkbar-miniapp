import { Controller, Get, Query } from '@nestjs/common'
import { IsOptional, IsString } from 'class-validator'
import { StaffAuthService } from '../../common/staff-auth.service'
import { FinanceService } from './finance.service'

class FinancePeriodQuery {
  @IsOptional()
  @IsString()
  from?: string

  @IsOptional()
  @IsString()
  to?: string

  @IsOptional()
  @IsString()
  staff_pin?: string

  @IsOptional()
  @IsString()
  staff_token?: string
}

@Controller('admin/finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly staffAuth: StaffAuthService
  ) {}

  @Get('overview')
  overview(@Query() query: FinancePeriodQuery) {
    this.assertOwner(query)
    return this.financeService.overview(this.period(query))
  }

  @Get('profit')
  profit(@Query() query: FinancePeriodQuery) {
    this.assertOwner(query)
    return this.financeService.profit(this.period(query))
  }

  @Get('dividend-basis')
  dividendBasis(@Query() query: FinancePeriodQuery) {
    this.assertOwner(query)
    return this.financeService.dividendBasis(this.period(query))
  }

  private period(query: FinancePeriodQuery) {
    return {
      from: query.from,
      to: query.to
    }
  }

  private assertOwner(query: FinancePeriodQuery) {
    this.staffAuth.assertStaff({
      staff_pin: query.staff_pin,
      staff_token: query.staff_token,
      ownerOnly: true,
      permission: 'finance:read'
    })
  }
}
