import { Module } from '@nestjs/common';

import { BinanceController } from './binance.controller';
import { BinanceService } from './binance.service';
import { TradesModule } from '../trades/trades.module';

@Module({
  imports: [TradesModule],
  controllers: [BinanceController],
  providers: [BinanceService],
})
export class BinanceModule {}