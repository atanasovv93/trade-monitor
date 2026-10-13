import { OnModuleDestroy } from '@nestjs/common';
import {
WebSocketGateway,
WebSocketServer,
OnGatewayConnection,
OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Subscription } from 'rxjs';
import { MarketDataService } from '../market-data.service';

@WebSocketGateway({
namespace: '/market-data',
cors: {
origin: '*',
},
})
export class MarketDataGateway
implements OnModuleDestroy, OnGatewayConnection, OnGatewayInit
{
@WebSocketServer()
server!: Server;

private subscription?: Subscription;

constructor(
private readonly marketDataService: MarketDataService,
) {}

afterInit(server: Server): void {
this.subscription = this.marketDataService.events$.subscribe(
(event) => {
server.emit('market-data', event);
},
);
}

handleConnection(client: Socket): void {
client.emit(
'market-data-snapshot',
this.marketDataService.getLatest(),
);
}

onModuleDestroy(): void {
this.subscription?.unsubscribe();
}
}