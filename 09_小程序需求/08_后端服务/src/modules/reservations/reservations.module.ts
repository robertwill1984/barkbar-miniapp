import { Module } from '@nestjs/common'
import { AdminReservationsController, ReservationsController } from './reservations.controller'
import { ReservationsService } from './reservations.service'
import { AgreementsModule } from '../agreements/agreements.module'

@Module({
  imports: [AgreementsModule],
  controllers: [ReservationsController, AdminReservationsController],
  providers: [ReservationsService]
})
export class ReservationsModule {}
