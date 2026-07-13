import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { IsArray, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator'
import { OrdersService } from './orders.service'

class OrderItemDto {
  @IsString()
  @MinLength(1)
  sku_id!: string

  @IsInt()
  @Min(1)
  quantity!: number
}

class CreateOrderDto {
  @IsString()
  @MinLength(1)
  user_id!: string

  @IsIn(['ticket', 'card', 'bar', 'retail'])
  scene!: 'ticket' | 'card' | 'bar' | 'retail'

  @IsArray()
  items!: OrderItemDto[]

  @IsOptional()
  @IsString()
  reservation_id?: string
}

@Controller('customer')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('products')
  products(@Query('scene') scene?: 'ticket' | 'card' | 'bar' | 'retail') {
    return this.ordersService.products(scene)
  }

  @Get('orders')
  list(@Query('user_id') userId: string, @Query('scene') scene?: 'ticket' | 'card' | 'bar' | 'retail') {
    return this.ordersService.list(userId, scene)
  }

  @Get('orders/:order_id/payment')
  paymentStatus(@Param('order_id') orderId: string, @Query('user_id') userId: string) {
    return this.ordersService.paymentStatus(orderId, userId)
  }

  @Post('orders')
  create(@Body() body: CreateOrderDto) {
    return this.ordersService.create(body)
  }
}

@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  adminList(
    @Query('staff_pin') staffPin: string,
    @Query('staff_token') staffToken?: string,
    @Query('user_id') userId?: string,
    @Query('scene') scene?: 'ticket' | 'card' | 'bar' | 'retail',
    @Query('status') status?: any
  ) {
    return this.ordersService.adminList({
      staff_pin: staffPin,
      staff_token: staffToken,
      user_id: userId,
      scene,
      status
    })
  }
}
