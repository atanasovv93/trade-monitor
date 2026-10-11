import {
Injectable,
Logger,
OnModuleDestroy,
OnModuleInit,
} from '@nestjs/common';
import WebSocket from 'ws';
import { ConfigService } from '@nestjs/config';

import { MarketDataService } from '../market-data/market-data.service';
import {
MarketDataEvent,
MarketStreamType,
BinanceCombinedMessage,
} from '../market-data/types/market-data.types';

import { CandlesService } from '../candles/candles.service';
import { TradesService } from '../trades/trades.service';
import { TradeInterface } from '../trades/interfaces/trade.interface';

@Injectable()
export class BinanceWssService
implements OnModuleInit, OnModuleDestroy
{
private readonly logger = new Logger(BinanceWssService.name);

private socket?: WebSocket;
private reconnectTimer?: ReturnType<typeof setTimeout>;
private reconnectAttempts = 0;
private stopping = false;

private readonly defaultSymbols = [
'BTCUSDT',
'ETHUSDT',
'BNBUSDT',
'SOLUSDT',
];

constructor(
private readonly configService: ConfigService,
private readonly marketDataService: MarketDataService,
private readonly tradesService: TradesService,
private readonly candlesService: CandlesService,
) {}

getSymbols(): string[] {
const configured = this.configService
.get<string>('SYMBOLS')
?.split(',')
.map((symbol) => symbol.trim().toUpperCase())
.filter(Boolean);

return [
  ...new Set(
    configured?.length ? configured : this.defaultSymbols,
  ),
];

}

onModuleInit(): void {
this.connect();
}

onModuleDestroy(): void {
this.stopping = true;

if (this.reconnectTimer) {
  clearTimeout(this.reconnectTimer);
  this.reconnectTimer = undefined;
}

const socket = this.socket;
this.socket = undefined;

if (socket && socket.readyState !== WebSocket.CLOSED) {
  socket.close();
}

}

private connect(): void {
if (this.stopping || this.socket) {
return;
}

const symbols = this.getSymbols();

if (symbols.length === 0) {
  this.logger.error(
    'No Binance symbols configured. Connection cancelled.',
  );
  return;
}

const streams = symbols.flatMap((symbol) => {
  const s = symbol.toLowerCase();

  return [
    `${s}@ticker`,
    `${s}@kline_1m`,
    `${s}@kline_1h`,
    `${s}@trade`,
    `${s}@bookTicker`,
  ];
});

const url =
  `wss://stream.binance.com:9443/stream?streams=${streams.join('/')}`;

this.logger.log(
  `Connecting to Binance combined stream for ${symbols.length} symbols`,
);

try {
  const socket = new WebSocket(url);
  this.socket = socket;

  socket.on('open', () => {
    this.reconnectAttempts = 0;
    this.logger.log('Binance combined WebSocket connected');
  });

  socket.on('message', (message) => {
    try {
      const parsed = JSON.parse(
        message.toString(),
      ) as BinanceCombinedMessage;

      void this.handleMessage(parsed);
    } catch (error) {
      const details =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Failed to parse Binance message: ${details}`,
      );
    }
  });

  socket.on('error', (error) => {
    this.logger.error(
      `Binance WebSocket error: ${error.message}`,
    );
  });

  socket.on('close', () => {
    if (this.socket === socket) {
      this.socket = undefined;
    }

    this.logger.warn('Binance WebSocket disconnected');
    this.scheduleReconnect();
  });
} catch (error) {
  this.socket = undefined;

  const details =
    error instanceof Error ? error.message : String(error);

  this.logger.error(
    `Failed to create Binance WebSocket: ${details}`,
  );

  this.scheduleReconnect();
}

}

private async handleMessage(
message: BinanceCombinedMessage,
): Promise<void> {
if (!message.stream || !message.data) {
return;
}

const [streamSymbol, streamName] = message.stream.split('@');

if (!streamSymbol || !streamName) {
  return;
}

let type: MarketStreamType;

switch (streamName) {
  case 'ticker':
    type = 'ticker';
    break;

  case 'kline_1m':
    type = 'kline';
    break;

  case 'kline_1h':
    type = 'kline_1h';
    break;

  case 'trade':
    type = 'trade';
    break;

  case 'bookTicker':
    type = 'bookTicker';
    break;

  default:
    return;
}

const event: MarketDataEvent = {
  symbol: streamSymbol.toUpperCase(),
  type,
  data: message.data,
  receivedAt: Date.now(),
};

// Objavi go nastanot za RAM cache i Socket.IO.
this.marketDataService.publish(event);

// Zapisuvaj individualni trades vo MongoDB.
if (type === 'trade') {
  try {
    const data = message.data;

    const price = Number(data['p']);
    const quantity = Number(data['q']);
    const tradeTimeMs = Number(data['T']);
    const eventTimeMs = Number(data['E']);
    const tradeId = Number(data['t']);

    if (
      !Number.isFinite(price) ||
      !Number.isFinite(quantity) ||
      !Number.isFinite(tradeTimeMs) ||
      !Number.isFinite(eventTimeMs) ||
      !Number.isSafeInteger(tradeId) ||
      tradeId < 0 ||
      price <= 0 ||
      quantity <= 0
    ) {
      this.logger.warn(
        `Skipping invalid trade for ${streamSymbol.toUpperCase()}`,
      );
      return;
    }

    const trade: TradeInterface = {
      symbol: String(data['s'] ?? streamSymbol).toUpperCase(),
      date: new Date(tradeTimeMs).toISOString().split('T')[0],
      tradeId,
      price,
      quantity,
      quoteQuantity: price * quantity,
      side: data['m'] === true ? 'SELL' : 'BUY',
      isBuyerMaker: data['m'] === true,
      eventTime: new Date(eventTimeMs),
      tradeTime: new Date(tradeTimeMs),
    };

    await this.tradesService.createTrade(trade);
  } catch (error) {
    const details =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      `Failed to save trade for ${streamSymbol.toUpperCase()}: ${details}`,
    );
  }
}

  // Zapisuvaj samo zavrsheni 1m candles vo MongoDB.
  if (type === 'kline') {
    try {
      await this.saveMinuteCandle(message.data);
    } catch (error) {
      const details =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Failed to save 1m candle for ${streamSymbol.toUpperCase()}: ${details}`,
      );
    }
  }

// Zapisuvaj samo zavrsheni 1h candles vo MongoDB.
if (type === 'kline_1h') {
  try {
    await this.saveHourlyCandle(message.data);
  } catch (error) {
    const details =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      `Failed to save hourly candle for ${streamSymbol.toUpperCase()}: ${details}`,
    );
  }
}

}

private async saveHourlyCandle(
data: Record<string, any>,
): Promise<void> {
const kline = data['k'];

this.logger.log(
  `1h candle received: ${String(kline?.s)}, closed: ${String(kline?.x)}`,
);

if (!kline) {
  return;
}

const openTime = Number(kline['t']);
const closeTime = Number(kline['T']);
const open = Number(kline['o']);
const high = Number(kline['h']);
const low = Number(kline['l']);
const close = Number(kline['c']);
const volume = Number(kline['v']);
const quoteVolume = Number(kline['q']);
const numberOfTrades = Number(kline['n']);

if (
  !Number.isFinite(openTime) ||
  !Number.isFinite(closeTime) ||
  !Number.isFinite(open) ||
  !Number.isFinite(high) ||
  !Number.isFinite(low) ||
  !Number.isFinite(close) ||
  !Number.isFinite(volume) ||
  !Number.isFinite(quoteVolume) ||
  !Number.isSafeInteger(numberOfTrades)
) {
  this.logger.warn('Skipping invalid hourly candle');
  return;
}

await this.candlesService.saveCandle({
  symbol: String(kline['s']).toUpperCase(),
  interval: '1h',
  openTime: new Date(openTime),
  closeTime: new Date(closeTime),
  open,
  high,
  low,
  close,
  volume,
  quoteVolume,
  numberOfTrades,
});

}

private scheduleReconnect(): void {
if (this.stopping || this.reconnectTimer) {
return;
}

const delay = Math.min(
  1_000 * 2 ** this.reconnectAttempts,
  30_000,
);

this.reconnectAttempts++;

this.logger.log(
  `Reconnecting to Binance in ${delay / 1000}s`,
);

this.reconnectTimer = setTimeout(() => {
  this.reconnectTimer = undefined;
  this.connect();
}, delay);

}


private async saveMinuteCandle(
  data: Record<string, any>,
): Promise<void> {
  const kline = data['k'];

  // Zapisuvaj samo zatvoreni 1m candles.
  if (!kline || kline['x'] !== true) {
    return;
  }

  const openTime = Number(kline['t']);
  const closeTime = Number(kline['T']);
  const open = Number(kline['o']);
  const high = Number(kline['h']);
  const low = Number(kline['l']);
  const close = Number(kline['c']);
  const volume = Number(kline['v']);
  const quoteVolume = Number(kline['q']);
  const numberOfTrades = Number(kline['n']);

  if (
    !Number.isFinite(openTime) ||
    !Number.isFinite(closeTime) ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    !Number.isFinite(volume) ||
    !Number.isFinite(quoteVolume) ||
    !Number.isSafeInteger(numberOfTrades)
  ) {
    this.logger.warn('Skipping invalid 1m candle');
    return;
  }

  await this.candlesService.saveCandle({
    symbol: String(kline['s']).toUpperCase(),
    interval: '1m',
    openTime: new Date(openTime),
    closeTime: new Date(closeTime),
    open,
    high,
    low,
    close,
    volume,
    quoteVolume,
    numberOfTrades,
  });
}

}