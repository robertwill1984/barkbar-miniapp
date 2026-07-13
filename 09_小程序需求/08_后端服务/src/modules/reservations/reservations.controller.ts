import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator'
import { ReservationsService } from './reservations.service'

class CreateReservationDto {
  @IsString()
  @MinLength(1)
  user_id!: string

  @IsString()
  @MinLength(1)
  slot_id!: string

  @IsInt()
  @Min(1)
  people_count!: number

  @IsArray()
  @IsString({ each: true })
  pet_ids!: string[]

  @IsIn(['SINGLE_TICKET', 'MEMBER_CARD'])
  entry_type!: 'SINGLE_TICKET' | 'MEMBER_CARD'
}

class CancelReservationDto {
  @IsString()
  @MinLength(1)
  user_id!: string

  @IsString()
  @MinLength(1)
  reason!: string

  @IsOptional()
  @IsBoolean()
  request_reschedule?: boolean
}

class GenerateCheckinCodeDto {
  @IsString()
  @MinLength(1)
  user_id!: string
}

class ReviewReservationDto {
  @IsIn(['APPROVE', 'REJECT'])
  action!: 'APPROVE' | 'REJECT'

  @IsOptional()
  @IsString()
  @MinLength(1)
  staff_pin?: string

  @IsOptional()
  @IsString()
  staff_token?: string

  @IsOptional()
  @IsString()
  note?: string
}

class CheckinReservationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  staff_pin?: string

  @IsOptional()
  @IsString()
  staff_token?: string

  @IsOptional()
  @IsString()
  note?: string
}

class VerifyCheckinCodeDto {
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

@Controller('customer')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get('reservation-slots')
  slots() {
    return this.reservationsService.slots()
  }

  @Get('reservations')
  list(@Query('user_id') userId: string) {
    return this.reservationsService.list(userId)
  }

  @Post('reservations')
  create(@Body() body: CreateReservationDto) {
    return this.reservationsService.create(body)
  }

  @Post('reservations/:reservation_id/cancel')
  cancel(@Param('reservation_id') reservationId: string, @Body() body: CancelReservationDto) {
    return this.reservationsService.cancel(reservationId, body)
  }

  @Post('reservations/:reservation_id/checkin-code')
  generateCheckinCode(@Param('reservation_id') reservationId: string, @Body() body: GenerateCheckinCodeDto) {
    return this.reservationsService.generateCheckinCode(reservationId, body)
  }
}

@Controller('admin/reservations')
export class AdminReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  adminList(@Query('status') status?: any, @Query('staff_pin') staffPin?: string, @Query('staff_token') staffToken?: string) {
    return this.reservationsService.adminList(status, {
      staff_pin: staffPin,
      staff_token: staffToken
    })
  }

  @Post(':reservation_id/review')
  review(@Param('reservation_id') reservationId: string, @Body() body: ReviewReservationDto) {
    return this.reservationsService.review(reservationId, body)
  }

  @Post(':reservation_id/checkin')
  checkin(@Param('reservation_id') reservationId: string, @Body() body: CheckinReservationDto) {
    return this.reservationsService.checkin(reservationId, body)
  }

  @Post('verify-code')
  verifyCode(@Body() body: VerifyCheckinCodeDto) {
    return this.reservationsService.verifyCheckinCode(body)
  }
}
