import { Module } from '@nestjs/common'
import { StoreModule } from './common/store.module'
import { AuthModule } from './modules/auth/auth.module'
import { PetsModule } from './modules/pets/pets.module'
import { AgreementsModule } from './modules/agreements/agreements.module'
import { ReservationsModule } from './modules/reservations/reservations.module'
import { FinanceModule } from './modules/finance/finance.module'
import { CardsModule } from './modules/cards/cards.module'
import { OrdersModule } from './modules/orders/orders.module'
import { RefundsModule } from './modules/refunds/refunds.module'

@Module({
  imports: [StoreModule, AuthModule, PetsModule, AgreementsModule, ReservationsModule, CardsModule, OrdersModule, RefundsModule, FinanceModule]
})
export class AppModule {}
