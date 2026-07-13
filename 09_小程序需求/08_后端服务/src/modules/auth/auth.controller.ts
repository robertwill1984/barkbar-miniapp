import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { IsOptional, IsString, MinLength } from 'class-validator'
import { AuthService } from './auth.service'

class WechatLoginDto {
  @IsString()
  @MinLength(3)
  code!: string

  @IsOptional()
  @IsString()
  nickname?: string
}

class StaffPinLoginDto {
  @IsString()
  @MinLength(4)
  staff_pin!: string
}

class StaffSessionDto {
  @IsOptional()
  @IsString()
  staff_pin?: string

  @IsOptional()
  @IsString()
  staff_token?: string
}

@Controller('customer/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wechat-login')
  @HttpCode(200)
  wechatLogin(@Body() body: WechatLoginDto) {
    return this.authService.wechatLogin(body)
  }
}

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('pin-login')
  @HttpCode(200)
  staffPinLogin(@Body() body: StaffPinLoginDto) {
    return this.authService.staffPinLogin(body)
  }

  @Post('session')
  @HttpCode(200)
  staffSession(@Body() body: StaffSessionDto) {
    return this.authService.staffSession(body)
  }
}
