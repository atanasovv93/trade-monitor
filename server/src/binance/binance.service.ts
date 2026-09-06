import { Injectable, OnModuleInit } from '@nestjs/common';
import WebSocket from 'ws';

@Injectable()
export class BinanceService implements OnModuleInit {
  private socket?: WebSocket;

  onModuleInit() {
    this.connect();
  }

  // GET /api/trades/symbols
  getSymbols(): string[] {
    return [
      'BTCUSDT',
      'ETHUSDT',
      'BNBUSDT',
      'SOLUSDT',
      'XRPUSDT',
      'ADAUSDT',
      'DOGEUSDT',
      'AVAXUSDT',
      'DOTUSDT',
      'LINKUSDT',
    ];
  }

  private connect() {
    const symbol = 'btcusdt';

    const url = `wss://stream.binance.com:9443/ws/${symbol}@trade`;

    console.log(`Connecting to Binance WSS: ${url}`);

    this.socket = new WebSocket(url);

    this.socket.on('open', () => {
      console.log('✅ Binance WSS connected');
    });

    this.socket.on('message', (message) => {
      const data = JSON.parse(message.toString());

      const price = Number(data.p);
      const quantity = Number(data.q);

      const side = data.m ? 'SELL' : 'BUY';

      console.log(
        `[TRADE] ${side} | ${symbol.toUpperCase()} | price=${price} | quantity=${quantity}`,
      );
    });

    this.socket.on('error', (error) => {
      console.error('❌ Binance WSS error:', error);
    });

    this.socket.on('close', () => {
      console.log('⚠️ Binance WSS disconnected');
    });
  }
}