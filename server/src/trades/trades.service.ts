import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';

import { Trade, TradeDocument } from './schemas/trade.schema';
import { TradeInterface } from './interfaces/trade.interface';

@Injectable()
export class TradesService {
  constructor(
    @InjectModel(Trade.name)
    private readonly tradeModel: Model<TradeDocument>,
  ) {}

  async createTrade(trade: TradeInterface): Promise<TradeDocument> {
    return this.tradeModel.create(trade);
  }

  async getTradesBySymbol(symbol: string): Promise<TradeDocument[]> {
    return this.tradeModel
      .find({
        symbol: symbol.toUpperCase(),
      })
      .sort({ tradeTime: -1 })
      .limit(100)
      .exec();
  }

  async getTradeStats(symbol: string) {
    const normalizedSymbol = symbol.toUpperCase();

    const now = new Date();

    const periods = {
      '1m': 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '3h': 3 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };

    const oldestCutoff = new Date(
      now.getTime() - periods['24h'],
    );

    const trades = await this.tradeModel
      .find({
        symbol: normalizedSymbol,
        tradeTime: {
          $gte: oldestCutoff,
        },
      })
      .sort({ tradeTime: -1 })
      .lean()
      .exec();

    const stats: Record<string, any> = {};

    for (const [period, milliseconds] of Object.entries(periods)) {
      const cutoff = new Date(now.getTime() - milliseconds);

      const periodTrades = trades.filter(
        (trade) => trade.tradeTime >= cutoff,
      );

      const buyTrades = periodTrades.filter(
        (trade) => trade.side === 'BUY',
      );

      const sellTrades = periodTrades.filter(
        (trade) => trade.side === 'SELL',
      );

      const buyVolume = buyTrades.reduce(
        (sum, trade) => sum + trade.quoteQuantity,
        0,
      );

      const sellVolume = sellTrades.reduce(
        (sum, trade) => sum + trade.quoteQuantity,
        0,
      );

      const totalVolume = buyVolume + sellVolume;

      const totalTrades = periodTrades.length;

      const buyPercent =
        totalTrades > 0
          ? (buyTrades.length / totalTrades) * 100
          : 0;

      const sellPercent =
        totalTrades > 0
          ? (sellTrades.length / totalTrades) * 100
          : 0;

      const buySellRatio =
        sellVolume > 0
          ? buyVolume / sellVolume
          : buyVolume > 0
            ? Infinity
            : 0;

      stats[period] = {
        trades: totalTrades,

        buy: buyTrades.length,
        sell: sellTrades.length,

        buyVolume: Number(buyVolume.toFixed(4)),
        sellVolume: Number(sellVolume.toFixed(4)),
        totalVolume: Number(totalVolume.toFixed(4)),

        buyPercent: Number(buyPercent.toFixed(2)),
        sellPercent: Number(sellPercent.toFixed(2)),

        buySellRatio:
          buySellRatio === Infinity
            ? null
            : Number(buySellRatio.toFixed(2)),
      };
    }

    return {
      symbol: normalizedSymbol,
      generatedAt: now,
      periods: stats,
    };
  }

  @Cron('*/10 * * * *')
  async cleanupOldTrades(): Promise<void> {
    const cutoff = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    );

    const result = await this.tradeModel.deleteMany({
      tradeTime: {
        $lt: cutoff,
      },
    });

    if (result.deletedCount > 0) {
      console.log(
        `🗑️ Cleanup: deleted ${result.deletedCount} trades older than 24 hours`,
      );
    }
  }
}
