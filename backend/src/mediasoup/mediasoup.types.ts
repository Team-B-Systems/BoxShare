import type {
    Router,
    WebRtcTransport,
    Producer,
    Consumer,
} from 'mediasoup/types';

/**
 * Represents a single SFU room managed by mediasoup.
 *
 * Each room has one Router and supports one host (producer)
 * plus multiple viewers (consumers).
 */
export interface Room {
    /** The mediasoup Router that handles media routing for this room */
    router: Router;

    /** Socket ID of the host who is screen-sharing */
    hostSocketId: string;

    /** All WebRtcTransports in this room, keyed by transport ID */
    transports: Map<string, WebRtcTransport>;

    /** All Producers in this room, keyed by producer ID */
    producers: Map<string, Producer>;

    /** All Consumers in this room, keyed by consumer ID */
    consumers: Map<string, Consumer>;

    /** Timestamp when the room was created */
    createdAt: Date;
}

/**
 * Data returned when a WebRtcTransport is created.
 * Sent to the client so it can connect via mediasoup-client.
 */
export interface TransportOptions {
    id: string;
    iceParameters: object;
    iceCandidates: object[];
    dtlsParameters: object;
}

/**
 * Data returned when a Consumer is created.
 * Sent to the viewer so they can consume the producer's media.
 */
export interface ConsumerData {
    id: string;
    producerId: string;
    kind: string;
    rtpParameters: object;
}
