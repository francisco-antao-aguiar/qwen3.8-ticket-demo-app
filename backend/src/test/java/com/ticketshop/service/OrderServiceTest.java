package com.ticketshop.service;

import com.ticketshop.dto.CreateOrderRequest;
import com.ticketshop.dto.OrderResponse;
import com.ticketshop.exception.NotFoundException;
import com.ticketshop.exception.SeatUnavailableException;
import com.ticketshop.model.Artist;
import com.ticketshop.model.Concert;
import com.ticketshop.model.Order;
import com.ticketshop.model.Seat;
import com.ticketshop.model.SeatStatus;
import com.ticketshop.model.Zone;
import com.ticketshop.repository.ConcertRepository;
import com.ticketshop.repository.OrderRepository;
import com.ticketshop.repository.SeatRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link OrderService} with mocked repositories:
 * order creation, totals, seat locking/re-check, reference format and lookup.
 */
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private SeatRepository seatRepository;
    @Mock
    private ConcertRepository concertRepository;
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private EmailService emailService;

    private OrderService orderService;

    private Concert concert;
    private Seat seat101;
    private Seat seat102;
    private Seat seat201;

    @BeforeEach
    void setUp() {
        orderService = new OrderService(seatRepository, concertRepository, orderRepository, emailService);

        Artist artist = new Artist();
        artist.setId(1L);
        artist.setName("Aurora Sky");

        concert = new Concert();
        concert.setId(1L);
        concert.setTitle("Skyline Live");
        concert.setArtist(artist);
        concert.setDate(LocalDate.of(2026, 10, 15));
        concert.setVenue("Riverside Arena");
        concert.setBasePrice(new BigDecimal("45.00"));

        seat101 = seat(101L, "A", 1, Zone.VIP, new BigDecimal("90.00"), SeatStatus.AVAILABLE, concert);
        seat102 = seat(102L, "A", 2, Zone.VIP, new BigDecimal("90.00"), SeatStatus.AVAILABLE, concert);
        seat201 = seat(201L, "B", 1, Zone.PREMIUM, new BigDecimal("67.50"), SeatStatus.AVAILABLE, concert);
    }

    private Seat seat(long id, String row, int number, Zone zone,
                      BigDecimal price, SeatStatus status, Concert concert) {
        Seat seat = new Seat();
        seat.setId(id);
        seat.setConcert(concert);
        seat.setRowLetter(row);
        seat.setSeatNumber(number);
        seat.setZone(zone);
        seat.setPrice(price);
        seat.setStatus(status);
        return seat;
    }

    private CreateOrderRequest request(long concertId, List<Long> seatIds) {
        return new CreateOrderRequest("Jane Doe", "jane@example.com", concertId, seatIds);
    }

    @Test
    void createsOrderAndMarksSeatsSold() {
        when(concertRepository.findById(1L)).thenReturn(Optional.of(concert));
        when(seatRepository.lockByIds(List.of(101L, 102L))).thenReturn(List.of(seat101, seat102));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderResponse response = orderService.createOrder(request(1L, List.of(101L, 102L)));

        assertEquals("Jane Doe", response.buyerName());
        assertEquals("jane@example.com", response.buyerEmail());
        assertEquals(0, new BigDecimal("180.00").compareTo(response.totalAmount()));
        assertEquals(2, response.seats().size());
        assertTrue(response.reference().matches("TCK-[A-HJ-NP-Z2-9]{6}"),
                "reference should look like TCK-XXXXXX, got: " + response.reference());
        assertEquals("Skyline Live", response.concert().title());
        assertEquals("Aurora Sky", response.concert().artistName());

        assertEquals(SeatStatus.SOLD, seat101.getStatus());
        assertEquals(SeatStatus.SOLD, seat102.getStatus());

        ArgumentCaptor<Order> saved = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(saved.capture());
        assertEquals(2, saved.getValue().getOrderSeats().size());
        assertEquals(0, new BigDecimal("180.00").compareTo(saved.getValue().getTotalAmount()));

        verify(emailService).sendOrderConfirmation(any(Order.class));
    }

    @Test
    void sortsSeatsByRowThenNumberInResponse() {
        when(concertRepository.findById(1L)).thenReturn(Optional.of(concert));
        // repository returns them in arbitrary order
        when(seatRepository.lockByIds(List.of(102L, 101L, 201L)))
                .thenReturn(List.of(seat201, seat102, seat101));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderResponse response = orderService.createOrder(request(1L, List.of(102L, 101L, 201L)));

        assertEquals(List.of(101L, 102L, 201L),
                response.seats().stream().map(OrderResponse.OrderSeatDto::id).toList());
    }

    @Test
    void throwsNotFoundForUnknownConcert() {
        when(concertRepository.findById(99L)).thenReturn(Optional.empty());

        NotFoundException ex = assertThrows(NotFoundException.class,
                () -> orderService.createOrder(request(99L, List.of(1L))));

        assertTrue(ex.getMessage().contains("99"));
        verify(seatRepository, never()).lockByIds(any());
    }

    @Test
    void throwsBadRequestWhenASeatDoesNotExist() {
        when(concertRepository.findById(1L)).thenReturn(Optional.of(concert));
        // only one of the two requested seats came back from the lock query
        when(seatRepository.lockByIds(List.of(101L, 999L))).thenReturn(List.of(seat101));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> orderService.createOrder(request(1L, List.of(101L, 999L))));

        assertTrue(ex.getMessage().contains("do not exist"));
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void throwsBadRequestWhenSeatBelongsToAnotherConcert() {
        Concert otherConcert = new Concert();
        otherConcert.setId(2L);
        otherConcert.setTitle("Waves After Dark");
        Seat foreign = seat(50L, "B", 1, Zone.PREMIUM, new BigDecimal("60.00"), SeatStatus.AVAILABLE, otherConcert);

        when(concertRepository.findById(1L)).thenReturn(Optional.of(concert));
        when(seatRepository.lockByIds(List.of(50L))).thenReturn(List.of(foreign));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> orderService.createOrder(request(1L, List.of(50L))));

        assertTrue(ex.getMessage().contains("does not belong"));
    }

    @Test
    void throwsConflictWhenASeatIsAlreadySold() {
        seat102.setStatus(SeatStatus.SOLD);
        when(concertRepository.findById(1L)).thenReturn(Optional.of(concert));
        when(seatRepository.lockByIds(List.of(101L, 102L))).thenReturn(List.of(seat101, seat102));

        SeatUnavailableException ex = assertThrows(SeatUnavailableException.class,
                () -> orderService.createOrder(request(1L, List.of(101L, 102L))));

        assertTrue(ex.getMessage().contains("102"));
        verify(orderRepository, never()).save(any(Order.class));
        verify(emailService, never()).sendOrderConfirmation(any(Order.class));
    }

    @Test
    void findsOrderByReference() {
        Order order = new Order();
        order.setId(7L);
        order.setReference("TCK-8FK2MQ");
        order.setBuyerName("Jane Doe");
        order.setBuyerEmail("jane@example.com");
        order.setCreatedAt(Instant.parse("2026-10-01T12:00:00Z"));
        order.setTotalAmount(new BigDecimal("90.00"));
        order.setConcert(concert);
        when(orderRepository.findByReference("TCK-8FK2MQ")).thenReturn(Optional.of(order));

        OrderResponse response = orderService.getOrder("TCK-8FK2MQ");

        assertEquals("TCK-8FK2MQ", response.reference());
        assertEquals("Jane Doe", response.buyerName());
        assertEquals("Skyline Live", response.concert().title());
    }

    @Test
    void throwsNotFoundForUnknownOrderReference() {
        when(orderRepository.findByReference("TCK-NOPE")).thenReturn(Optional.empty());

        NotFoundException ex = assertThrows(NotFoundException.class,
                () -> orderService.getOrder("TCK-NOPE"));

        assertTrue(ex.getMessage().contains("TCK-NOPE"));
    }
}
