import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';

/**
 * REST controller for managing screen-sharing sessions.
 * Provides endpoints for creating, listing, and validating sessions.
 */
@Controller('sessions')
export class SessionsController {
    constructor(private readonly sessionsService: SessionsService) { }

    /**
     * POST /sessions
     * Create a new sharing session and return the sessionId + PIN.
     */
    @Post()
    createSession(@Body('machineName') machineName: string) {
        if (!machineName) {
            throw new HttpException(
                'machineName is required',
                HttpStatus.BAD_REQUEST,
            );
        }
        const session = this.sessionsService.createSession(machineName);
        return {
            sessionId: session.sessionId,
            pin: session.pin,
            machineName: session.machineName,
        };
    }

    /**
     * GET /sessions
     * Return all active sharing sessions.
     */
    @Get()
    getAllSessions() {
        return this.sessionsService.getAllSessions();
    }

    /**
     * POST /sessions/:id/validate
     * Validate the PIN for a given session.
     * Returns session info if the PIN is correct.
     */
    @Post(':id/validate')
    validatePin(
        @Param('id') sessionId: string,
        @Body('pin') pin: string,
    ) {
        if (!pin) {
            throw new HttpException('pin is required', HttpStatus.BAD_REQUEST);
        }

        const isValid = this.sessionsService.validatePin(sessionId, pin);
        if (!isValid) {
            throw new HttpException('Invalid PIN', HttpStatus.UNAUTHORIZED);
        }

        const session = this.sessionsService.getSession(sessionId);
        return {
            valid: true,
            sessionId: session!.sessionId,
            pin: session!.pin,
        };
    }
}
