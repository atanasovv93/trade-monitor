import { Module } from '@nestjs/common';
import { BinanceController } from './binance.controller';
import { BinanceWssService } from './binance-wss.service';
import { MarketDataModule } from '../market-data/market-data.module';
import { TradesModule } from '../trades/trades.module';

@Module({
imports: [MarketDataModule, TradesModule],
controllers: [BinanceController],
providers: [BinanceWssService],
})
export class BinanceModule {}