import { Module } from '@nestjs/common';
import { SignalingGateway } from './signaling.gateway';
import { SignalingService } from './signaling.service';
import { SessionsModule } from '../sessions/sessions.module';

/**
 * Signaling module.
 * Contains the WebSocket gateway that handles all WebRTC signaling
 * (offer/answer/ICE candidate exchange) between hosts and viewers.
 */
@Module({
    imports: [SessionsModule],
    providers: [SignalingGateway, SignalingService],
})
export class SignalingModule { }
