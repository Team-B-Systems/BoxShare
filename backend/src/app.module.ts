import { Module } from '@nestjs/common';
import { SessionsModule } from './sessions/sessions.module.js';
import { MediasoupModule } from './mediasoup/mediasoup.module.js';

/**
 * Root application module.
 * Imports:
 * - SessionsModule: HTTP endpoints for session management (create, list, validate PIN)
 * - MediasoupModule: SFU engine + WebSocket signaling for WebRTC media routing
 */
@Module({
  imports: [SessionsModule, MediasoupModule],
})
export class AppModule { }
