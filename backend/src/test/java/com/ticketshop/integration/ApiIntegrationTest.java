package com.ticketshop.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketshop.model.Seat;
import com.ticketshop.model.SeatStatus;
import com.ticketshop.repository.ConcertRepository;
import com.ticketshop.repository.SeatRepository;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Full-stack API tests: boots the real Spring context (H2 in-memory DB,
 * DataSeeder running, mocked SMTP sender) and exercises every REST endpoint
 * over MockMvc — including the transactional double-booking guard.
 *
 * Tests share the seeded database within this class, so they always fetch
 * fresh AVAILABLE seats instead of assuming fixed ids or statuses.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ConcertRepository concertRepository;

    @Autowired
    private SeatRepository seatRepository;

    @MockBean
    private JavaMailSender mailSender;

    @BeforeEach
    void setUp() throws Exception {
        when(mailSender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
        clearInvocations(mailSender);
    }

    // ---------- helpers ----------

    private List<Seat> availableSeats(Long concertId) {
        return seatRepository.findByConcertIdOrderByRowLetterAscSeatNumberAsc(concertId).stream()
                .filter(seat -> seat.getStatus() == SeatStatus.AVAILABLE)
                .toList();
    }

    private List<Seat> pickAvailableSeats(int count) {
        for (var concert : concertRepository.findByOrderByDateAsc()) {
            List<Seat> available = availableSeats(concert.getId());
            if (available.size() >= count) {
                return List.copyOf(available.subList(0, count));
            }
        }
        throw new IllegalStateException("Seeded data should have at least " + count + " available seats");
    }

    /** Expiry MM/YY one year ahead, so the test never expires. */
    private static String futureExpiry() {
        YearMonth m = YearMonth.now().plusYears(1);
        return String.format("%02d/%02d", m.getMonthValue(), m.getYear() % 100);
    }

    private String createOrder(List<Seat> seats, Long concertId) throws Exception {
        String payload = objectMapper.writeValueAsString(Map.of(
                "buyerName", "Integration Tester",
                "buyerEmail", "it@ticketshop.local",
                "concertId", concertId,
                "seatIds", seats.stream().map(Seat::getId).toList()));
        MvcResult result = mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("reference").asText();
    }

    // ---------- GET /api/artists ----------

    @Test
    void artistsEndpointReturnsTheFiveSeededArtists() throws Exception {
        mockMvc.perform(get("/api/artists"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(5)))
                .andExpect(jsonPath("$[0].name").value("Aurora Sky"))
                .andExpect(jsonPath("$[*].id", everyItem(notNullValue())));
    }

    // ---------- GET /api/concerts ----------

    @Test
    void concertsEndpointReturnsTwelveConcertsOrderedByDate() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/concerts"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode concerts = objectMapper.readTree(result.getResponse().getContentAsString());

        assertThat(concerts.size()).isEqualTo(12);
        for (int i = 1; i < concerts.size(); i++) {
            assertThat(concerts.get(i - 1).get("date").asText())
                    .as("concert %d should not be after concert %d", i - 1, i)
                    .isLessThanOrEqualTo(concerts.get(i).get("date").asText());
        }
        assertThat(concerts.get(0).get("artistName").asText()).isNotBlank();
        assertThat(concerts.get(0).get("basePrice").decimalValue()).isGreaterThan(BigDecimal.ZERO);
    }

    @Test
    void concertsCanBeFilteredByArtist() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/concerts").param("artistId", "1"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode concerts = objectMapper.readTree(result.getResponse().getContentAsString());

        assertThat(concerts.size()).isGreaterThanOrEqualTo(1).isLessThan(12);
        for (JsonNode concert : concerts) {
            assertThat(concert.get("artistId").asLong()).isEqualTo(1);
            assertThat(concert.get("artistName").asText()).isEqualTo("Aurora Sky");
        }
    }

    // ---------- GET /api/concerts/{id}/seats ----------

    @Test
    void seatMapReturnsTwoHundredSeatsWithZonePricing() throws Exception {
        var concert = concertRepository.findAll().get(0);
        BigDecimal basePrice = concert.getBasePrice();

        MvcResult result = mockMvc.perform(get("/api/concerts/" + concert.getId() + "/seats"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode map = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode seats = map.get("seats");

        assertThat(map.get("concert").get("id").asLong()).isEqualTo(concert.getId());
        assertThat(seats).hasSize(200);

        for (JsonNode seat : seats) {
            String row = seat.get("rowLetter").asText();
            String zone = seat.get("zone").asText();
            assertThat(zone).as("zone of row %s", row).isEqualTo(switch (row) {
                case "A", "B", "C" -> "VIP";
                case "D", "E", "F" -> "PREMIUM";
                default -> "STANDARD";
            });
            BigDecimal factor = switch (zone) {
                case "VIP" -> new BigDecimal("2");
                case "PREMIUM" -> new BigDecimal("1.5");
                default -> BigDecimal.ONE;
            };
            BigDecimal expectedPrice = basePrice.multiply(factor).setScale(2, RoundingMode.HALF_UP);
            assertThat(seat.get("price").decimalValue())
                    .isCloseTo(expectedPrice, within(BigDecimal.ZERO));
            assertThat(seat.get("status").asText()).isIn("AVAILABLE", "SOLD");
        }
    }

    @Test
    void seatMapOfUnknownConcertReturns404() throws Exception {
        mockMvc.perform(get("/api/concerts/999999/seats"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("error").value(containsString("Concert not found: 999999")));
    }

    // ---------- POST /api/payments ----------

    @Test
    void paymentWithValidCardIsApproved() throws Exception {
        mockMvc.perform(post("/api/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "buyerName", "Jane Doe",
                                "cardNumber", "4242 4242 4242 4242",
                                "cardExpiry", futureExpiry(),
                                "cardCvv", "123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("status").value("APPROVED"))
                .andExpect(jsonPath("last4").value("4242"))
                .andExpect(jsonPath("paymentId", startsWith("pay_")));
    }

    @Test
    void paymentWithDeclineCardIsDeclined() throws Exception {
        mockMvc.perform(post("/api/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "buyerName", "Jane Doe",
                                "cardNumber", "4242 4242 4242 0000",
                                "cardExpiry", futureExpiry(),
                                "cardCvv", "123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("status").value("DECLINED"))
                .andExpect(jsonPath("declineReason", containsString("declined by issuer")));
    }

    @Test
    void paymentWithInvalidCardNumberIsDeclined() throws Exception {
        mockMvc.perform(post("/api/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "buyerName", "Jane Doe",
                                "cardNumber", "1234",
                                "cardExpiry", futureExpiry(),
                                "cardCvv", "123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("status").value("DECLINED"))
                .andExpect(jsonPath("declineReason").value("Card number is invalid."));
    }

    @Test
    void paymentWithMissingFieldsReturns400() throws Exception {
        mockMvc.perform(post("/api/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"buyerName\":\"Jane\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("error").value(containsString("cardNumber")));
    }

    // ---------- POST /api/orders ----------

    @Test
    void orderCreationReturnsOrderWithReferenceAndTotal() throws Exception {
        List<Seat> seats = pickAvailableSeats(3);
        Long concertId = seats.get(0).getConcert().getId();

        MvcResult result = mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "buyerName", "Jane Doe",
                                "buyerEmail", "jane@example.com",
                                "concertId", concertId,
                                "seatIds", seats.stream().map(Seat::getId).toList()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("reference", matchesPattern("TCK-[A-HJ-NP-Z2-9]{6}")))
                .andExpect(jsonPath("buyerName").value("Jane Doe"))
                .andExpect(jsonPath("seats", hasSize(3)))
                .andReturn();
        JsonNode order = objectMapper.readTree(result.getResponse().getContentAsString());

        BigDecimal expectedTotal = seats.stream()
                .map(Seat::getPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(order.get("totalAmount").decimalValue())
                .isCloseTo(expectedTotal, within(BigDecimal.ZERO));
        assertThat(order.get("concert").get("id").asLong()).isEqualTo(concertId);
    }

    @Test
    void orderCreationMarksTheSeatsAsSold() throws Exception {
        List<Seat> seats = pickAvailableSeats(2);
        Long concertId = seats.get(0).getConcert().getId();

        createOrder(seats, concertId);

        for (Seat seat : seats) {
            assertThat(seatRepository.findById(seat.getId()).orElseThrow().getStatus())
                    .as("seat %d should now be SOLD", seat.getId())
                    .isEqualTo(SeatStatus.SOLD);
        }
    }

    @Test
    void orderCreationRejectsMoreThanFourSeats() throws Exception {
        List<Seat> seats = pickAvailableSeats(5);
        Long concertId = seats.get(0).getConcert().getId();

        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "buyerName", "Jane",
                                "buyerEmail", "jane@example.com",
                                "concertId", concertId,
                                "seatIds", seats.stream().map(Seat::getId).toList()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("error").value(containsString("seatIds")));
    }

    @Test
    void orderCreationRejectsAnInvalidEmail() throws Exception {
        List<Seat> seats = pickAvailableSeats(1);
        Long concertId = seats.get(0).getConcert().getId();

        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "buyerName", "Jane",
                                "buyerEmail", "not-an-email",
                                "concertId", concertId,
                                "seatIds", List.of(seats.get(0).getId())))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("error").value(containsString("buyerEmail")));
    }

    @Test
    void orderCreationWithUnknownConcertReturns404() throws Exception {
        List<Seat> seats = pickAvailableSeats(1);

        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "buyerName", "Jane",
                                "buyerEmail", "jane@example.com",
                                "concertId", 999999L,
                                "seatIds", List.of(seats.get(0).getId())))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("error").value(containsString("Concert not found")));
    }

    @Test
    void orderingAnAlreadySoldSeatReturns409() throws Exception {
        Seat seat = pickAvailableSeats(1).get(0);
        Long concertId = seat.getConcert().getId();
        createOrder(List.of(seat), concertId); // this order wins the seat

        String payload = objectMapper.writeValueAsString(Map.of(
                "buyerName", "Jane",
                "buyerEmail", "jane@example.com",
                "concertId", concertId,
                "seatIds", List.of(seat.getId())));
        mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("error").value(containsString("already sold")));
    }

    @Test
    void concurrentOrdersForTheSameSeatYieldExactlyOneWinner() throws Exception {
        Seat seat = pickAvailableSeats(1).get(0);
        Long concertId = seat.getConcert().getId();
        String payload = objectMapper.writeValueAsString(Map.of(
                "buyerName", "Racer",
                "buyerEmail", "racer@example.com",
                "concertId", concertId,
                "seatIds", List.of(seat.getId())));

        CyclicBarrier barrier = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<Integer>> futures = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                futures.add(pool.submit(() -> {
                    barrier.await();
                    return mockMvc.perform(post("/api/orders")
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(payload))
                            .andReturn().getResponse().getStatus();
                }));
            }
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> future : futures) {
                statuses.add(future.get(30, TimeUnit.SECONDS));
            }
            // the pessimistic row lock serializes the two transactions:
            // the first sees AVAILABLE and wins, the second sees SOLD and gets 409
            assertThat(statuses).containsExactlyInAnyOrder(200, 409);
        } finally {
            pool.shutdownNow();
        }
    }

    // ---------- GET /api/orders/{reference} ----------

    @Test
    void orderLookupByReference() throws Exception {
        List<Seat> seats = pickAvailableSeats(1);
        Long concertId = seats.get(0).getConcert().getId();
        String reference = createOrder(seats, concertId);

        mockMvc.perform(get("/api/orders/" + reference))
                .andExpect(status().isOk())
                .andExpect(jsonPath("reference").value(reference))
                .andExpect(jsonPath("seats", hasSize(1)));

        mockMvc.perform(get("/api/orders/TCK-UNKNOWN"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("error").value(containsString("Order not found")));
    }

    // ---------- confirmation email ----------

    @Test
    void successfulOrderTriggersConfirmationEmailToTheBuyer() throws Exception {
        List<Seat> seats = pickAvailableSeats(1);
        Long concertId = seats.get(0).getConcert().getId();
        String reference = createOrder(seats, concertId);

        // EmailService is @Async: wait for the send to land on the mocked sender.
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, timeout(10_000).atLeastOnce()).send(captor.capture());

        // Other tests may have triggered stray emails on the shared mock, so match
        // by this test's unique order reference.
        assertThat(captor.getAllValues()).anySatisfy(message -> {
            try {
                assertThat(message.getSubject()).as("subject").contains(reference);
                assertThat(message.getAllRecipients()[0].toString())
                        .as("To").isEqualTo("it@ticketshop.local");
                message.saveChanges();
                String html = (String) message.getContent();
                assertThat(html).contains("Integration Tester");
            } catch (Exception e) {
                throw new AssertionError("could not inspect confirmation email", e);
            }
        });
    }
}
