package com.ticketshop.dto;

import java.util.List;

public record SeatMapResponse(ConcertDto concert, List<SeatDto> seats) {
}
