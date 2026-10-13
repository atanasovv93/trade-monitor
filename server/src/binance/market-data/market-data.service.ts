import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Subject } from 'rxjs';
import {
  MarketDataEvent,
  MarketStreamType,
} from './types/market-data.types';

@Injectable()
export class MarketDataService implements OnModuleDestroy {
  private readonly eventsSubject = new Subject<MarketDataEvent>();

  readonly events$ = this.eventsSubject.asObservable();

  private readonly latestByKey = new Map<string, MarketDataEvent>();

  publish(event: MarketDataEvent): void {
    const key = `${event.symbol}:${event.type}`;

    this.latestByKey.set(key, event);
    this.eventsSubject.next(event);
  }

  getLatest(
    symbol?: string,
    type?: MarketStreamType,
  ): MarketDataEvent[] {
    return [...this.latestByKey.values()].filter((event) => {
      const matchesSymbol =
        !symbol || event.symbol === symbol.toUpperCase();

      const matchesType = !type || event.type === type;

      return matchesSymbol && matchesType;
    });
  }

  onModuleDestroy(): void {
    this.eventsSubject.complete();
    this.latestByKey.clear();
  }
}