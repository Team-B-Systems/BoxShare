import { Module } from '@nestjs/common';
import { MediasoupService } from './mediasoup.service.js';
import { RoomsService } from './rooms.service.js';
import { RoomsGateway } from './rooms.gateway.js';
import { SessionsModule } from '../sessions/sessions.module.js';

/**
 * MediasoupModule provides the SFU (Selective Forwarding Unit) functionality.
 */
@Module({
    imports: [SessionsModule],
    providers: [MediasoupService, RoomsService, RoomsGateway],
    exports: [RoomsService],
})
export class MediasoupModule { }
