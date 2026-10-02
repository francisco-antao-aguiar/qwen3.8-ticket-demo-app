package com.ticketshop.config;

import com.ticketshop.model.Artist;
import com.ticketshop.model.Concert;
import com.ticketshop.model.Seat;
import com.ticketshop.model.SeatStatus;
import com.ticketshop.model.Zone;
import com.ticketshop.repository.ArtistRepository;
import com.ticketshop.repository.ConcertRepository;
import com.ticketshop.repository.SeatRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link DataSeeder}: 5 artists, 12 concerts, 10x20 seats per
 * concert with zone pricing (VIP 2x, PREMIUM 1.5x, STANDARD 1x), ~15% pre-sold,
 * and the idempotency guard.
 */
@ExtendWith(MockitoExtension.class)
class DataSeederTest {

    private static final BigDecimal[] BASE_PRICES = {
            new BigDecimal("45.00"), new BigDecimal("45.00"), new BigDecimal("55.00"),
            new BigDecimal("60.00"), new BigDecimal("50.00"), new BigDecimal("70.00"),
            new BigDecimal("65.00"), new BigDecimal("75.00"), new BigDecimal("40.00"),
            new BigDecimal("45.00"), new BigDecimal("80.00"), new BigDecimal("55.00")
    };

    @Mock
    private ArtistRepository artistRepository;
    @Mock
    private ConcertRepository concertRepository;
    @Mock
    private SeatRepository seatRepository;

    private final List<Artist> artists = new ArrayList<>();
    private final List<Concert> concerts = new ArrayList<>();
    private final List<List<Seat>> seatBatches = new ArrayList<>();
    private long idSequence = 0;

    private DataSeeder seeder;

    @BeforeEach
    void setUp() {
        // Build the seeder here, not in a field initializer: field
        // initializers run before Mockito has injected the @Mock fields.
        seeder = new DataSeeder(artistRepository, concertRepository, seatRepository);

        lenient().when(artistRepository.count()).thenReturn(0L);
        lenient().when(artistRepository.findAll()).thenAnswer(inv -> new ArrayList<>(artists));
        lenient().when(artistRepository.save(any(Artist.class))).thenAnswer(inv -> {
            Artist artist = inv.getArgument(0);
            artist.setId(++idSequence);
            artists.add(artist);
            return artist;
        });
        lenient().when(concertRepository.save(any(Concert.class))).thenAnswer(inv -> {
            Concert concert = inv.getArgument(0);
            concert.setId(++idSequence);
            concerts.add(concert);
            return concert;
        });
        lenient().when(seatRepository.saveAll(anyList())).thenAnswer(inv -> {
            List<Seat> batch = inv.getArgument(0);
            batch.forEach(seat -> seat.setId(++idSequence));
            seatBatches.add(batch);
            return batch;
        });
    }

    @Test
    void seedsFiveArtistsTwelveConcertsAndTwoHundredSeatsEach() {
        seeder.run();

        assertEquals(5, artists.size());
        assertEquals(List.of(
                "Aurora Sky", "The Midnight Waves", "Neon Pulse", "Luna & the Tides", "Steel Horizon"),
                artists.stream().map(Artist::getName).toList());

        assertEquals(12, concerts.size());
        assertEquals(12, seatBatches.size());
        for (List<Seat> batch : seatBatches) {
            assertEquals(200, batch.size());
        }
    }

    @Test
    void assignsZonesAndPricesPerZoneMultiplier() {
        seeder.run();

        for (int i = 0; i < seatBatches.size(); i++) {
            BigDecimal basePrice = BASE_PRICES[i];
            for (Seat seat : seatBatches.get(i)) {
                Zone expectedZone = switch (seat.getRowLetter()) {
                    case "A", "B", "C" -> Zone.VIP;
                    case "D", "E", "F" -> Zone.PREMIUM;
                    default -> Zone.STANDARD;
                };
                assertEquals(expectedZone, seat.getZone(),
                        "row " + seat.getRowLetter() + " should be " + expectedZone);

                BigDecimal factor = switch (expectedZone) {
                    case VIP -> new BigDecimal("2");
                    case PREMIUM -> new BigDecimal("1.5");
                    case STANDARD -> BigDecimal.ONE;
                };
                BigDecimal expectedPrice = basePrice.multiply(factor).setScale(2, RoundingMode.HALF_UP);
                assertEquals(0, expectedPrice.compareTo(seat.getPrice()),
                        "price of " + seat.getRowLetter() + seat.getSeatNumber()
                                + " should be " + expectedPrice + ", was " + seat.getPrice());
            }
        }
    }

    @Test
    void createsTenRowsOfTwentySeatsPerConcert() {
        seeder.run();

        for (List<Seat> batch : seatBatches) {
            Map<String, List<Seat>> byRow = batch.stream()
                    .collect(Collectors.groupingBy(Seat::getRowLetter));
            assertEquals(10, byRow.size(), "expected rows A-J");
            for (String row : List.of("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")) {
                assertEquals(20, byRow.get(row).size());
                for (int n = 1; n <= 20; n++) {
                    final int seatNumber = n;
                    assertTrue(byRow.get(row).stream().anyMatch(s -> s.getSeatNumber() == seatNumber),
                            row + " should contain seat " + seatNumber);
                }
            }
        }
    }

    @Test
    void preSoldsAroundFifteenPercentOfSeats() {
        seeder.run();

        // 200 seats per concert with p=0.15: a batch ending up all-AVAILABLE
        // or all-SOLD is ~1e-15 unlikely, so assert both statuses exist.
        for (List<Seat> batch : seatBatches) {
            long available = batch.stream().filter(s -> s.getStatus() == SeatStatus.AVAILABLE).count();
            long sold = batch.size() - available;
            assertTrue(available > 0, "every concert should have available seats");
            assertTrue(sold > 0, "every concert should have some pre-sold seats");
        }
    }

    @Test
    void schedulesConcertsInTheFuture() {
        seeder.run();

        LocalDate today = LocalDate.now();
        for (Concert concert : concerts) {
            assertTrue(concert.getDate().isAfter(today),
                    concert.getTitle() + " should be in the future, got " + concert.getDate());
        }
    }

    @Test
    void skipsSeedingWhenDataAlreadyExists() {
        when(artistRepository.count()).thenReturn(5L);

        seeder.run();

        verifyNoInteractions(concertRepository, seatRepository);
        assertEquals(0, artists.size());
    }
}
