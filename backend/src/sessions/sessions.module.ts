import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';

/**
 * Sessions module.
 * Manages screen-sharing sessions — creation, listing, PIN validation, etc.
 * The service is exported so the Signaling module can also use it.
 */
@Module({
    controllers: [SessionsController],
    providers: [SessionsService],
    exports: [SessionsService],
})
export class SessionsModule { }
