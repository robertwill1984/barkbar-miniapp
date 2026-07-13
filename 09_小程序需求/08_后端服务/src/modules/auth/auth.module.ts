import { Module } from '@nestjs/common'
import { AdminAuthController, AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  controllers: [AuthController, AdminAuthController],
  providers: [AuthService]
})
export class AuthModule {}
