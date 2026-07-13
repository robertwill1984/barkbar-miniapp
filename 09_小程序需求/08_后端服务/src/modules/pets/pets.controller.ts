import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator'
import { PetsService } from './pets.service'

class CreatePetDto {
  @IsString()
  @MinLength(1)
  user_id!: string

  @IsString()
  @MinLength(1)
  name!: string

  @IsString()
  @MinLength(1)
  breed!: string

  @IsOptional()
  @IsString()
  size_class?: string

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  weight_kg?: number

  @IsOptional()
  @IsIn(['UNKNOWN', 'VALID', 'EXPIRED'])
  vaccination_status?: 'UNKNOWN' | 'VALID' | 'EXPIRED'

  @IsOptional()
  @IsIn(['UNKNOWN', 'VALID', 'MISSING'])
  license_status?: 'UNKNOWN' | 'VALID' | 'MISSING'

  @IsOptional()
  @IsBoolean()
  attack_history?: boolean
}

@Controller('customer/pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Get()
  list(@Query('user_id') userId: string) {
    return this.petsService.list(userId)
  }

  @Post()
  create(@Body() body: CreatePetDto) {
    return this.petsService.create(body)
  }
}
