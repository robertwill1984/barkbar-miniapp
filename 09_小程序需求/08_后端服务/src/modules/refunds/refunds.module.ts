import { Module } from '@nestjs/common'
import { AdminRefundsController, RefundsController } from './refunds.controller'
import { RefundsService } from './refunds.service'

@Module({
  controllers: [RefundsController, AdminRefundsController],
  providers: [RefundsService]
})
export class RefundsModule {}
