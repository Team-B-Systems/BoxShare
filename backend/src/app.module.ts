import { Module } from '@nestjs/common';
import { SessionsModule } from './sessions/sessions.module';
import { SignalingModule } from './signaling/signaling.module';

/**
 * Root application module.
 * Imports the Sessions module (HTTP endpoints) and Signaling module (WebSocket gateway).
 */
@Module({
  imports: [SessionsModule, SignalingModule],
})
export class AppModule { }
