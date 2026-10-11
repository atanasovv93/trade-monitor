
export type MarketStreamType =
  | 'ticker'
  | 'kline'
  | 'trade'
  | 'bookTicker';

export interface MarketDataEvent {
  symbol: string;
  type: MarketStreamType;
  data: unknown;
  receivedAt: number;
}

export interface BinanceCombinedMessage {
  stream: string;
  data: Record<string, unknown>;
}