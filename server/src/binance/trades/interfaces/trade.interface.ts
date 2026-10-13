export interface TradeInterface {
  symbol: string;
  date: string;

  tradeId: number;

  price: number;
  quantity: number;
  quoteQuantity: number;

  side: 'BUY' | 'SELL';
  isBuyerMaker: boolean;

  eventTime: Date;
  tradeTime: Date;
}