import { Module } from '@nestjs/common';
import { BinanceController } from './binance.controller';
import { BinanceWssService } from './binance-wss.service';
import { MarketDataModule } from './market-data/market-data.module';
import { TradesModule } from './trades/trades.module';
import { CandlesModule } from './candles/candles.module';


@Module({
imports: [MarketDataModule, TradesModule, CandlesModule],
controllers: [BinanceController],
providers: [BinanceWssService],
})
export class BinanceModule {}