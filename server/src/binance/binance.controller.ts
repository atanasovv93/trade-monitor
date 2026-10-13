import { Controller, Get, Query } from '@nestjs/common';
import { BinanceWssService } from './binance-wss.service';
import { MarketDataService } from './market-data/market-data.service';
import * as marketDataTypes from './market-data/types/market-data.types';

@Controller('trades')
export class BinanceController {
constructor(
private readonly binanceWssService: BinanceWssService,
private readonly marketDataService: MarketDataService,
) {}

@Get('symbols')
getSymbols() {
return this.binanceWssService.getSymbols();
}

@Get('market-data')
getMarketData(
@Query('symbol') symbol?: string,
@Query('type') type?: marketDataTypes.MarketStreamType,
) {
return this.marketDataService.getLatest(
symbol,
type,
);
}
}