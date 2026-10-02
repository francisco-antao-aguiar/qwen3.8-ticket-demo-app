package com.ticketshop.service;

import com.ticketshop.dto.CreateOrderRequest;
import com.ticketshop.dto.OrderResponse;
import com.ticketshop.exception.NotFoundException;
import com.ticketshop.exception.SeatUnavailableException;
import com.ticketshop.model.Concert;
import com.ticketshop.model.Order;
import com.ticketshop.model.OrderSeat;
import com.ticketshop.model.Seat;
import com.ticketshop.model.SeatStatus;
import com.ticketshop.repository.ConcertRepository;
import com.ticketshop.repository.OrderRepository;
import com.ticketshop.repository.SeatRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;

@Service
public class OrderService {

    private static final String REFERENCE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SeatRepository seatRepository;
    private final ConcertRepository concertRepository;
    private final OrderRepository orderRepository;
    private final EmailService emailService;

    public OrderService(SeatRepository seatRepository,
                        ConcertRepository concertRepository,
                        OrderRepository orderRepository,
                        EmailService emailService) {
        this.seatRepository = seatRepository;
        this.concertRepository = concertRepository;
        this.orderRepository = orderRepository;
        this.emailService = emailService;
    }

    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request) {
        Concert concert = concertRepository.findById(request.concertId())
                .orElseThrow(() -> new NotFoundException("Concert not found: " + request.concertId()));

        // Lock the requested seat rows (SELECT ... FOR UPDATE) so concurrent
        // orders for the same seats are serialized inside this transaction.
        List<Seat> seats = seatRepository.lockByIds(request.seatIds());
        if (seats.size() != request.seatIds().size()) {
            throw new IllegalArgumentException("One or more seats do not exist.");
        }
        for (Seat seat : seats) {
            if (!concert.getId().equals(seat.getConcert().getId())) {
                throw new IllegalArgumentException(
                        "Seat " + seat.getId() + " does not belong to concert " + concert.getId() + ".");
            }
        }

        // Re-check availability right before selling.
        List<Long> takenSeatIds = seats.stream()
                .filter(seat -> seat.getStatus() != SeatStatus.AVAILABLE)
                .map(Seat::getId)
                .toList();
        if (!takenSeatIds.isEmpty()) {
            throw new SeatUnavailableException("Seat(s) already sold: " + takenSeatIds);
        }

        Order order = new Order();
        order.setReference(generateReference());
        order.setBuyerName(request.buyerName());
        order.setBuyerEmail(request.buyerEmail());
        order.setCreatedAt(Instant.now());
        order.setConcert(concert);

        BigDecimal total = BigDecimal.ZERO;
        for (Seat seat : seats) {
            seat.setStatus(SeatStatus.SOLD);

            OrderSeat orderSeat = new OrderSeat();
            orderSeat.setOrder(order);
            orderSeat.setSeat(seat);
            order.getOrderSeats().add(orderSeat);

            total = total.add(seat.getPrice());
        }
        order.setTotalAmount(total);

        Order saved = orderRepository.save(order);
        // Fire-and-forget: the confirmation email is sent asynchronously and
        // a mail failure never blocks or rolls back the order.
        emailService.sendOrderConfirmation(saved);
        return OrderResponse.from(saved);
    }

    public OrderResponse getOrder(String reference) {
        return orderRepository.findByReference(reference)
                .map(OrderResponse::from)
                .orElseThrow(() -> new NotFoundException("Order not found: " + reference));
    }

    private String generateReference() {
        StringBuilder sb = new StringBuilder("TCK-");
        for (int i = 0; i < 6; i++) {
            sb.append(REFERENCE_CHARS.charAt(RANDOM.nextInt(REFERENCE_CHARS.length())));
        }
        return sb.toString();
    }
}
