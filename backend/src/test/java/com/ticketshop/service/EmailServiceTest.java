package com.ticketshop.service;

import com.ticketshop.model.Artist;
import com.ticketshop.model.Concert;
import com.ticketshop.model.Order;
import com.ticketshop.model.OrderSeat;
import com.ticketshop.model.Seat;
import com.ticketshop.model.SeatStatus;
import com.ticketshop.model.Zone;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link EmailService}: the confirmation mail is addressed to the
 * buyer, BCC'd to the watch address, contains the order details — and a mail
 * failure is swallowed so it can never fail the order.
 */
@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock
    private JavaMailSender mailSender;

    private EmailService emailService;
    private MimeMessage message;

    @BeforeEach
    void setUp() throws MessagingException {
        emailService = new EmailService(mailSender);
        ReflectionTestUtils.setField(emailService, "fromAddress", "TicketShop <no-reply@ticketshop.local>");
        ReflectionTestUtils.setField(emailService, "bccAddress", "watch@ticketshop.local");
        message = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(message);
    }

    private Order sampleOrder() {
        Artist artist = new Artist();
        artist.setId(1L);
        artist.setName("Aurora Sky");

        Concert concert = new Concert();
        concert.setId(1L);
        concert.setTitle("Skyline Live");
        concert.setArtist(artist);
        concert.setDate(LocalDate.of(2026, 10, 15));
        concert.setVenue("Riverside Arena");
        concert.setBasePrice(new BigDecimal("45.00"));

        Seat seat = new Seat();
        seat.setId(101L);
        seat.setConcert(concert);
        seat.setRowLetter("A");
        seat.setSeatNumber(1);
        seat.setZone(Zone.VIP);
        seat.setPrice(new BigDecimal("90.00"));
        seat.setStatus(SeatStatus.SOLD);

        Order order = new Order();
        order.setId(7L);
        order.setReference("TCK-8FK2MQ");
        order.setBuyerName("Jane Doe");
        order.setBuyerEmail("jane@example.com");
        order.setCreatedAt(Instant.parse("2026-10-01T12:00:00Z"));
        order.setConcert(concert);
        order.setTotalAmount(new BigDecimal("90.00"));
        OrderSeat orderSeat = new OrderSeat();
        orderSeat.setSeat(seat);
        order.getOrderSeats().add(orderSeat);
        return order;
    }

    private static String bodyOf(MimeMessage message) throws Exception {
        try {
            message.saveChanges();
        } catch (Exception ignored) {
            // in-memory test message: saving is best-effort
        }
        return (String) message.getContent();
    }

    @Test
    void sendsHtmlConfirmationToBuyerAndBccWatchAddress() throws Exception {
        emailService.sendOrderConfirmation(sampleOrder());

        verify(mailSender).send(message);
        assertEquals(2, message.getAllRecipients().length);
        assertEquals("jane@example.com", message.getAllRecipients()[0].toString());
        assertEquals("watch@ticketshop.local", message.getAllRecipients()[1].toString());
        assertTrue(message.getSubject().contains("TCK-8FK2MQ"),
                "subject should contain the order reference, got: " + message.getSubject());
        assertEquals("no-reply@ticketshop.local",
                ((InternetAddress) message.getFrom()[0]).getAddress());

        String html = bodyOf(message);
        assertTrue(html.contains("Jane Doe"));
        assertTrue(html.contains("Skyline Live"));
        assertTrue(html.contains("Aurora Sky"));
        assertTrue(html.contains("Riverside Arena"));
        assertTrue(html.contains("Row A"));
        // same (locale-sensitive) formatting the service uses for the total
        String expectedTotal = String.format("%.2f", new BigDecimal("90.00"));
        assertTrue(html.contains("Total: " + expectedTotal + " USD"),
                "body should contain the formatted total");
    }

    @Test
    void omitsBccWhenWatchAddressIsBlank() throws Exception {
        ReflectionTestUtils.setField(emailService, "bccAddress", "   ");

        emailService.sendOrderConfirmation(sampleOrder());

        verify(mailSender).send(message);
        assertEquals(1, message.getAllRecipients().length);
        assertEquals("jane@example.com", message.getAllRecipients()[0].toString());
    }

    @Test
    void escapesHtmlInBuyerName() throws Exception {
        Order order = sampleOrder();
        order.setBuyerName("<script>alert(1)</script>");

        emailService.sendOrderConfirmation(order);

        String html = bodyOf(message);
        assertTrue(html.contains("&lt;script&gt;"), "buyer name should be HTML-escaped");
        assertTrue(!html.contains("<script>"), "raw script tag must not reach the mail body");
    }

    @Test
    void swallowsMailSendFailuresSoTheOrderIsNeverBlocked() {
        doThrow(new MailSendException("SMTP server unreachable"))
                .when(mailSender).send(any(MimeMessage.class));

        assertDoesNotThrow(() -> emailService.sendOrderConfirmation(sampleOrder()));

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
    }
}
