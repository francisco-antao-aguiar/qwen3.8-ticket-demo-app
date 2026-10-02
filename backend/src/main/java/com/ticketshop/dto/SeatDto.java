package com.ticketshop.dto;

import com.ticketshop.model.Seat;
import com.ticketshop.model.SeatStatus;
import com.ticketshop.model.Zone;

import java.math.BigDecimal;

public record SeatDto(
        Long id,
        String rowLetter,
        Integer seatNumber,
        Zone zone,
        BigDecimal price,
        SeatStatus status
) {

    public static SeatDto from(Seat seat) {
        return new SeatDto(
                seat.getId(),
                seat.getRowLetter(),
                seat.getSeatNumber(),
                seat.getZone(),
                seat.getPrice(),
                seat.getStatus()
        );
    }
}
