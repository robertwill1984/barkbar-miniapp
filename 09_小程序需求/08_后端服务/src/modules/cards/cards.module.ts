import { Module } from '@nestjs/common'
import { AdminCardsController, AdminRedemptionsController, CardsController } from './cards.controller'
import { CardsService } from './cards.service'

@Module({
  controllers: [CardsController, AdminRedemptionsController, AdminCardsController],
  providers: [CardsService]
})
export class CardsModule {}
