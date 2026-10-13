import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MetalsController } from './metals.controller';
import { MetalsService } from './metals.service';
import { Metal, MetalSchema } from './schemas/metal.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Metal.name, schema: MetalSchema },
    ]),
  ],
  controllers: [MetalsController],
  providers: [MetalsService],
  exports: [MetalsService],
})
export class MetalsModule {}