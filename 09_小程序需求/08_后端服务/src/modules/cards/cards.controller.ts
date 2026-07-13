import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { IsOptional, IsString, MinLength } from 'class-validator'
import { CardsService } from './cards.service'

class GenerateCardCodeDto {
  @IsString()
  @MinLength(1)
  user_id!: string
}

class ConsumeCardCodeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  staff_pin?: string

  @IsOptional()
  @IsString()
  staff_token?: string

  @IsString()
  @MinLength(1)
  code!: string

  @IsOptional()
  @IsString()
  note?: string
}

@Controller('customer/cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get()
  list(@Query('user_id') userId: string) {
    return this.cardsService.list(userId)
  }

  @Post(':card_id/redemption-code')
  generateCode(@Param('card_id') cardId: string, @Body() body: GenerateCardCodeDto) {
    return this.cardsService.generateCode(cardId, body)
  }
}

@Controller('admin/redemptions')
export class AdminRedemptionsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post('consume-code')
  consumeCode(@Body() body: ConsumeCardCodeDto) {
    return this.cardsService.consumeCode(body)
  }
}

@Controller('admin/cards')
export class AdminCardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Get()
  adminList(
    @Query('staff_pin') staffPin: string,
    @Query('staff_token') staffToken?: string,
    @Query('user_id') userId?: string,
    @Query('status') status?: any
  ) {
    return this.cardsService.adminList({
      staff_pin: staffPin,
      staff_token: staffToken,
      user_id: userId,
      status
    })
  }
}
