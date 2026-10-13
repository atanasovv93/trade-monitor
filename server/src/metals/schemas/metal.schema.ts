import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MetalDocument = HydratedDocument<Metal>;

@Schema({ collection: 'metals', timestamps: false })
export class Metal {
  @Prop({ required: true, index: true })
  symbol!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, type: Number })
  value!: number;

  @Prop({ required: true, type: Number, default: 0 })
  change!: number;

  @Prop({ required: true, type: Number, default: 0 })
  changePercent!: number;

  @Prop({ required: true, type: Date, default: Date.now })
  timestamp!: Date;
}

export const MetalSchema = SchemaFactory.createForClass(Metal);

MetalSchema.index({ symbol: 1, timestamp: -1 });