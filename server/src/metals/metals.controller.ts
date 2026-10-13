import { Controller, Get, Param } from '@nestjs/common';
import { MetalsService } from './metals.service';

@Controller('metals')
export class MetalsController {
  constructor(private readonly metalsService: MetalsService) {}

  @Get('latest')
  async latest() {
    return this.metalsService.getLatest();
  }

  @Get('history/:symbol')
  async historyBySymbol(@Param('symbol') symbol: string) {
    return this.metalsService.getHistoryBySymbol(symbol);
  }
}