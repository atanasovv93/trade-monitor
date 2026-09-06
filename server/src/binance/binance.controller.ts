import { Controller, Get } from '@nestjs/common';
import { BinanceService } from './binance.service';

@Controller('api/trades')
export class BinanceController {
  constructor(private readonly binanceService: BinanceService) {}

  @Get('symbols')
  getSymbols() {
    return this.binanceService.getSymbols();
  }
}