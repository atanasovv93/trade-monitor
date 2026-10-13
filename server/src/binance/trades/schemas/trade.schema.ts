import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TradeDocument = HydratedDocument<Trade>;

@Schema({
  collection: 'trades',
  timestamps: false,
})
export class Trade {
  @Prop({
    required: true,
    index: true,
  })
  symbol!: string;

    @Prop({
    required: true,
    index: true,
  })
  date!: string;

  @Prop({
    required: true,
    index: true,
  })
  tradeId!: number;

  @Prop({
    required: true,
  })
  price!: number;

  @Prop({
    required: true,
  })
  quantity!: number;

  @Prop({
    required: true,
  })
  quoteQuantity!: number;

  @Prop({
    required: true,
    enum: ['BUY', 'SELL'],
    index: true,
  })
  side!: 'BUY' | 'SELL';

  @Prop({
    required: true,
  })
  isBuyerMaker!: boolean;

  @Prop({
    required: true,
    index: true,
  })
  eventTime!: Date;

  @Prop({
    required: true,
    index: true,
  })
  tradeTime!: Date;
}

export const TradeSchema = SchemaFactory.createForClass(Trade);

TradeSchema.index(
  { symbol: 1, tradeId: 1 },
  { unique: true },
);