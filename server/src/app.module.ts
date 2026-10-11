import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BinanceModule } from './binance/binance.module';
import { TradesModule } from './trades/trades.module';
import { CandlesModule } from './candles/candles.module';


@Module({
imports: [
ConfigModule.forRoot({
isGlobal: true,
}),

ScheduleModule.forRoot(),

MongooseModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    uri: configService.get<string>('MONGODB_URI'),
  }),
}),

BinanceModule,
TradesModule,
CandlesModule,
],

controllers: [AppController],
providers: [AppService],
})
export class AppModule {}