import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';

import { Candle, CandleDocument } from './schemas/candle.schema';

@Injectable()
export class CandlesService {
private readonly logger = new Logger(CandlesService.name);

constructor(
@InjectModel(Candle.name)
private readonly candleModel: Model<CandleDocument>,
) {}

async saveCandle(
candle: Partial<Candle>,
): Promise<CandleDocument> {
return this.candleModel.findOneAndUpdate(
{
symbol: candle.symbol,
interval: candle.interval ?? '1h',
openTime: candle.openTime,
},
{ $set: candle },
{
upsert: true,
returnDocument: 'after',
runValidators: true,
},
).exec() as Promise<CandleDocument>;
}

@Cron('0 0 * * *')
async cleanupOldCandles(): Promise<void> {
const now = new Date();

const sevenDaysAgo = new Date(now);
sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

const twoYearsAgo = new Date(now);
twoYearsAgo.setUTCFullYear(twoYearsAgo.getUTCFullYear() - 2);

const [minuteResult, hourlyResult] = await Promise.all([
  this.candleModel.deleteMany({
    interval: '1m',
    openTime: { $lt: sevenDaysAgo },
  }),
  this.candleModel.deleteMany({
    interval: '1h',
    openTime: { $lt: twoYearsAgo },
  }),
]);

this.logger.log(
  `Candle cleanup: deleted ${minuteResult.deletedCount} 1m candles and ${hourlyResult.deletedCount} 1h candles`,
);

}
}