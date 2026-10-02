package com.ticketshop.exception;

/**
 * Thrown when at least one requested seat is no longer AVAILABLE.
 * Mapped to HTTP 409 Conflict.
 */
public class SeatUnavailableException extends RuntimeException {

    public SeatUnavailableException(String message) {
        super(message);
    }
}
