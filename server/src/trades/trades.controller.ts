import { Controller, Get, Param } from '@nestjs/common';

import { TradesService } from './trades.service';

@Controller('api/trades')
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get('stats/:symbol')
  getTradeStats(@Param('symbol') symbol: string) {
    return this.tradesService.getTradeStats(symbol);
  }

  @Get(':symbol')
  getTradesBySymbol(@Param('symbol') symbol: string) {
    return this.tradesService.getTradesBySymbol(symbol);
  }
}
