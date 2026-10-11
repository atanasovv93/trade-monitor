import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CandleDocument = HydratedDocument<Candle>;

@Schema({
  collection: 'candles',
  timestamps: false,
})
export class Candle {
  @Prop({ required: true })
  symbol!: string;

  @Prop({ required: true, default: '1h' })
  interval!: string;

  @Prop({ required: true, type: Date })
  openTime!: Date;

  @Prop({ required: true, type: Date })
  closeTime!: Date;

  @Prop({ required: true })
  open!: number;

  @Prop({ required: true })
  high!: number;

  @Prop({ required: true })
  low!: number;

  @Prop({ required: true })
  close!: number;

  @Prop({ required: true })
  volume!: number;

  @Prop({ required: true })
  quoteVolume!: number;

  @Prop({ required: true })
  numberOfTrades!: number;
}

export const CandleSchema = SchemaFactory.createForClass(Candle);

CandleSchema.index(
  { symbol: 1, interval: 1, openTime: 1 },
  { unique: true },
);

CandleSchema.index({ openTime: 1 });