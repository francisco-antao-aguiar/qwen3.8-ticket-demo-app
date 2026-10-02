package com.ticketshop.dto;

import com.ticketshop.model.Concert;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ConcertDto(
        Long id,
        String title,
        Long artistId,
        String artistName,
        LocalDate date,
        String venue,
        BigDecimal basePrice
) {

    public static ConcertDto from(Concert concert) {
        return new ConcertDto(
                concert.getId(),
                concert.getTitle(),
                concert.getArtist().getId(),
                concert.getArtist().getName(),
                concert.getDate(),
                concert.getVenue(),
                concert.getBasePrice()
        );
    }
}
