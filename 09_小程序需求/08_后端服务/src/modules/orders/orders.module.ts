import { Module } from '@nestjs/common'
import { AdminOrdersController, OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'

@Module({
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService]
})
export class OrdersModule {}
