package com.ticketshop.dto;

import com.ticketshop.model.Concert;
import com.ticketshop.model.Order;
import com.ticketshop.model.OrderSeat;
import com.ticketshop.model.Seat;
import com.ticketshop.model.Zone;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;

public record OrderResponse(
        Long id,
        String reference,
        String buyerName,
        String buyerEmail,
        String createdAt,
        BigDecimal totalAmount,
        OrderConcertDto concert,
        List<OrderSeatDto> seats
) {

    public record OrderConcertDto(Long id, String title, String artistName, String date, String venue) {
    }

    public record OrderSeatDto(Long id, String rowLetter, Integer seatNumber, Zone zone, BigDecimal price) {
    }

    public static OrderResponse from(Order order) {
        Concert concert = order.getConcert();
        OrderConcertDto concertDto = new OrderConcertDto(
                concert.getId(),
                concert.getTitle(),
                concert.getArtist().getName(),
                concert.getDate().toString(),
                concert.getVenue()
        );
        List<OrderSeatDto> seats = order.getOrderSeats().stream()
                .sorted(Comparator
                        .comparing((OrderSeat os) -> os.getSeat().getRowLetter())
                        .thenComparingInt(os -> os.getSeat().getSeatNumber()))
                .map(os -> {
                    Seat seat = os.getSeat();
                    return new OrderSeatDto(
                            seat.getId(),
                            seat.getRowLetter(),
                            seat.getSeatNumber(),
                            seat.getZone(),
                            seat.getPrice()
                    );
                })
                .toList();
        return new OrderResponse(
                order.getId(),
                order.getReference(),
                order.getBuyerName(),
                order.getBuyerEmail(),
                order.getCreatedAt().toString(),
                order.getTotalAmount(),
                concertDto,
                seats
        );
    }
}
