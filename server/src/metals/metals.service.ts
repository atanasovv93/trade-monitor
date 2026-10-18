import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { Metal, MetalDocument } from './schemas/metal.schema';
import { MetalDto } from './dto/metals.dto';
import { MetalsApiResponse } from './interfaces/metals-api-response.interface';

@Injectable()
export class MetalsService {
    private readonly logger = new Logger(MetalsService.name);
  private readonly apiKey: string | undefined;
private readonly apiUrl: string;
private readonly CACHE_TIME = 8 * 60 * 60 * 1000;

constructor(
  @InjectModel(Metal.name)
  private readonly metalModel: Model<MetalDocument>,
  private readonly configService: ConfigService,
) {
  this.apiKey = this.configService.get<string>('METALS_API_KEY');
  this.apiUrl =
    this.configService.get<string>('METALS_API_URL') ||
    'https://api.metals.dev/v1/latest';
}

  async getLatest(): Promise<MetalDto[]> {
    const latestRecord = await this.metalModel
      .findOne()
      .sort({ timestamp: -1, _id: -1 })
      .exec();

    if (latestRecord) {
      const age = Date.now() - latestRecord.timestamp.getTime();

      if (age >= 0 && age < this.CACHE_TIME) {
        this.logger.log('Returning cached metals from MongoDB.');
        const cached = await this.getLatestRecords();
        return cached.map((metal) => this.toDto(metal));
      }
    }

    if (!this.apiKey) {
      this.logger.error('METALS_API_KEY is not configured.');
      throw new HttpException(
        'Metals API key is not configured.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const response = await axios.get<MetalsApiResponse>(
        this.apiUrl,
        {
          params: {
            api_key: this.apiKey,
            currency: 'USD',
            unit: 'g',
          },
          timeout: 10000,
        },
      );

      const metals = response.data?.metals;

      if (!metals) {
        throw new Error('Invalid response received from Metals API.');
      }

      const latestMetals = [
        { symbol: 'GOLD', name: 'Gold', value: Number(metals.gold) },
        { symbol: 'SILVER', name: 'Silver', value: Number(metals.silver) },
        {
          symbol: 'PLATINUM',
          name: 'Platinum',
          value: Number(metals.platinum),
        },
        {
          symbol: 'PALLADIUM',
          name: 'Palladium',
          value: Number(metals.palladium),
        },
      ];

      if (latestMetals.some((metal) => !Number.isFinite(metal.value))) {
        throw new Error('Metals API returned an invalid metal value.');
      }

      const previousRecords = await this.getLatestRecords();
      const previousMap = new Map<string, number>();

      for (const metal of previousRecords) {
        previousMap.set(metal.symbol, Number(metal.value));
      }

      const recordsToSave = latestMetals.map((metal) => {
        const current = metal.value;
        const previous = previousMap.get(metal.symbol);

        let change = 0;
        let changePercent = 0;

        if (previous !== undefined && Number.isFinite(previous)) {
          change = Number((current - previous).toFixed(4));

          if (previous !== 0) {
            changePercent = Number(((change / previous) * 100).toFixed(3));
          }
        }

        return {
          ...metal,
          change,
          changePercent,
          timestamp: new Date(),
        };
      });

      await this.metalModel.insertMany(recordsToSave);

      const inserted = await this.getLatestRecords();
      return inserted.map((metal) => this.toDto(metal));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Metals API request failed: ${error.response?.status ?? ''} ${error.message}`,
        );
      } else {
        this.logger.error(
          error instanceof Error ? error.message : String(error),
        );
      }

      throw new HttpException(
        'Unable to fetch metals.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private async getLatestRecords(): Promise<MetalDocument[]> {
    const records = await this.metalModel
      .find()
      .sort({ timestamp: -1, _id: -1 })
      .exec();

    const latestBySymbol = new Map<string, MetalDocument>();

    for (const record of records) {
      if (!latestBySymbol.has(record.symbol)) {
        latestBySymbol.set(record.symbol, record);
      }
    }

    return Array.from(latestBySymbol.values()).sort((a, b) =>
      a.symbol.localeCompare(b.symbol),
    );
  }

  private toDto(metal: MetalDocument): MetalDto {
    const change = Number(metal.change);
    const changePercent = Number(metal.changePercent);

    let trend = '⏸️ No change detected';

    if (change > 0) {
      trend = '📈 Rise during the day';
    } else if (change < 0) {
      trend = '📉 Fall during the day';
    }

    return {
      symbol: metal.symbol,
      name: metal.name,
      value: Number(metal.value),
      change,
      changePercent,
      trend,
      timestamp: metal.timestamp.toISOString(),
    };
  }

  async getHistoryBySymbol(symbol: string): Promise<MetalDto[]> {
    const normalizedSymbol = symbol.toUpperCase();

    const allowedSymbols = [
      'GOLD',
      'SILVER',
      'PLATINUM',
      'PALLADIUM',
    ];

    if (!allowedSymbols.includes(normalizedSymbol)) {
      throw new HttpException(
        `Unsupported metal symbol: ${normalizedSymbol}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const records = await this.metalModel
      .find({ symbol: normalizedSymbol })
      .sort({ timestamp: 1, _id: 1 })
      .exec();

    return records.map((metal, index) => {
      const current = Number(metal.value);
      const previous =
        index > 0 ? Number(records[index - 1].value) : undefined;

      const change =
        previous !== undefined
          ? Number((current - previous).toFixed(4))
          : 0;

      const changePercent =
        previous !== undefined && previous !== 0
          ? Number(((change / previous) * 100).toFixed(3))
          : 0;

      let trend = '⏸️ No change detected';

      if (change > 0) {
        trend = '📈 Rise';
      } else if (change < 0) {
        trend = '📉 Fall';
      }

      return {
        symbol: metal.symbol,
        name: metal.name,
        value: current,
        change,
        changePercent,
        trend,
        timestamp: metal.timestamp.toISOString(),
      };
    });
  }
}