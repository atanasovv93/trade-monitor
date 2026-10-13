import { Injectable, OnModuleInit } from '@nestjs/common';
import WebSocket from 'ws';

import { TradesService } from './trades/trades.service';
import { BinanceTradeEvent } from './trades/interfaces/binance-trade.interface';
import { TradeInterface } from './trades/interfaces/trade.interface';

@Injectable()
export class BinanceService implements OnModuleInit {
  private sockets = new Map<string, WebSocket>();

  constructor(private readonly tradesService: TradesService) {}

  onModuleInit() {
    this.connectToSymbols();
  }

  getSymbols(): string[] {
    return [
      'BTCUSDT',
      'ETHUSDT',
      'BNBUSDT',
      'SOLUSDT',
      'XRPUSDT',
      'DOGEUSDT',
      'AVAXUSDT',
      'DOTUSDT',
      'LINKUSDT',
      'ADAUSDT',
      'AXSUSDT',
    ];
  }

  private connectToSymbols() {
    const symbols = this.getSymbols();

    for (const symbol of symbols) {
      this.connect(symbol);
    }
  }

  private connect(symbol: string) {
    const streamSymbol = symbol.toLowerCase();

    const url = `wss://stream.binance.com:9443/ws/${streamSymbol}@trade`;

    console.log(`Connecting to Binance WSS: ${url}`);

    const socket = new WebSocket(url);

    this.sockets.set(symbol, socket);

    socket.on('open', () => {
      console.log(`✅ ${symbol} WSS connected`);
    });

    socket.on('message', async (message) => {
      try {
        const data: BinanceTradeEvent = JSON.parse(
          message.toString(),
        );

        const trade: TradeInterface = {
          symbol: data.s,
          tradeId: data.t,
          date: new Date(data.T).toISOString().split('T')[0],

          price: Number(data.p),
          quantity: Number(data.q),
          quoteQuantity: Number(data.p) * Number(data.q),

          side: data.m ? 'SELL' : 'BUY',
          isBuyerMaker: data.m,

          eventTime: new Date(data.E),
          tradeTime: new Date(data.T),
        };

        await this.tradesService.createTrade(trade);

      } catch (error) {
        console.error('❌ Failed to process trade:', error);
      }
    });

    socket.on('error', (error) => {
      console.error(`❌ ${symbol} WSS error:`, error);
    });

    socket.on('close', () => {
      console.log(`⚠️ ${symbol} WSS disconnected`);

      this.sockets.delete(symbol);
    });
  }
}