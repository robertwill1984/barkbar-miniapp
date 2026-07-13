import { Global, Module } from '@nestjs/common'
import { InMemoryStore } from './store.service'
import { StaffAuthService } from './staff-auth.service'

@Global()
@Module({
  providers: [InMemoryStore, StaffAuthService],
  exports: [InMemoryStore, StaffAuthService]
})
export class StoreModule {}
