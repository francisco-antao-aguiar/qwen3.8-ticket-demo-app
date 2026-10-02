package com.ticketshop.config;

import com.ticketshop.model.Artist;
import com.ticketshop.model.Concert;
import com.ticketshop.model.Seat;
import com.ticketshop.model.SeatStatus;
import com.ticketshop.model.Zone;
import com.ticketshop.repository.ArtistRepository;
import com.ticketshop.repository.ConcertRepository;
import com.ticketshop.repository.SeatRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Seeds the in-memory database on every startup:
 * 5 artists, 2-3 concerts each over the next three weeks,
 * 10 x 20 seats per concert with zone pricing, ~15% of seats pre-sold.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final String[] ROWS = {"A", "B", "C", "D", "E", "F", "G", "H", "I", "J"};
    private static final int SEATS_PER_ROW = 20;
    private static final double PRE_SOLD_RATIO = 0.15;

    private final ArtistRepository artistRepository;
    private final ConcertRepository concertRepository;
    private final SeatRepository seatRepository;

    public DataSeeder(ArtistRepository artistRepository,
                      ConcertRepository concertRepository,
                      SeatRepository seatRepository) {
        this.artistRepository = artistRepository;
        this.concertRepository = concertRepository;
        this.seatRepository = seatRepository;
    }

    private record ConcertSeed(String title, String artistName, int dayOffset, String venue, BigDecimal basePrice) {
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (artistRepository.count() > 0) {
            return; // already seeded
        }

        List<String> artistNames = List.of(
                "Aurora Sky",
                "The Midnight Waves",
                "Neon Pulse",
                "Luna & the Tides",
                "Steel Horizon"
        );
        for (String name : artistNames) {
            Artist artist = new Artist();
            artist.setName(name);
            artistRepository.save(artist);
        }

        List<ConcertSeed> seeds = List.of(
                new ConcertSeed("Skyline Live", "Aurora Sky", 3, "Riverside Arena", new BigDecimal("45.00")),
                new ConcertSeed("Skyline Tour", "Aurora Sky", 11, "Grand Hall", new BigDecimal("45.00")),
                new ConcertSeed("Skyline World Tour", "Aurora Sky", 19, "City Stadium", new BigDecimal("55.00")),
                new ConcertSeed("Waves After Dark", "The Midnight Waves", 5, "The Dome", new BigDecimal("60.00")),
                new ConcertSeed("Ocean Sessions", "The Midnight Waves", 14, "Riverside Arena", new BigDecimal("50.00")),
                new ConcertSeed("Pulse in the Dark", "Neon Pulse", 7, "The Dome", new BigDecimal("70.00")),
                new ConcertSeed("Neon Nights", "Neon Pulse", 16, "Grand Hall", new BigDecimal("65.00")),
                new ConcertSeed("Moondance Tour", "Neon Pulse", 21, "City Stadium", new BigDecimal("75.00")),
                new ConcertSeed("Tides of Light", "Luna & the Tides", 9, "Riverside Arena", new BigDecimal("40.00")),
                new ConcertSeed("Luna Live", "Luna & the Tides", 18, "The Dome", new BigDecimal("45.00")),
                new ConcertSeed("Steel & Thunder", "Steel Horizon", 12, "City Stadium", new BigDecimal("80.00")),
                new ConcertSeed("Horizon Festival", "Steel Horizon", 20, "Festival Park", new BigDecimal("55.00"))
        );

        LocalDate today = LocalDate.now();
        for (ConcertSeed seed : seeds) {
            Concert concert = new Concert();
            concert.setTitle(seed.title());
            concert.setArtist(artistRepository.findAll().stream()
                    .filter(a -> a.getName().equals(seed.artistName()))
                    .findFirst()
                    .orElseThrow());
            concert.setDate(today.plusDays(seed.dayOffset()));
            concert.setVenue(seed.venue());
            concert.setBasePrice(seed.basePrice());
            concertRepository.save(concert);

            List<Seat> seats = new ArrayList<>();
            ThreadLocalRandom random = ThreadLocalRandom.current();
            for (String row : ROWS) {
                for (int number = 1; number <= SEATS_PER_ROW; number++) {
                    Seat seat = new Seat();
                    seat.setConcert(concert);
                    seat.setRowLetter(row);
                    seat.setSeatNumber(number);
                    Zone zone = zoneFor(row);
                    seat.setZone(zone);
                    seat.setPrice(priceFor(zone, seed.basePrice()));
                    seat.setStatus(random.nextDouble() < PRE_SOLD_RATIO ? SeatStatus.SOLD : SeatStatus.AVAILABLE);
                    seats.add(seat);
                }
            }
            seatRepository.saveAll(seats);
        }
    }

    private Zone zoneFor(String row) {
        return switch (row) {
            case "A", "B", "C" -> Zone.VIP;
            case "D", "E", "F" -> Zone.PREMIUM;
            default -> Zone.STANDARD;
        };
    }

    private BigDecimal priceFor(Zone zone, BigDecimal basePrice) {
        BigDecimal factor = switch (zone) {
            case VIP -> new BigDecimal("2");
            case PREMIUM -> new BigDecimal("1.5");
            case STANDARD -> BigDecimal.ONE;
        };
        return basePrice.multiply(factor).setScale(2, RoundingMode.HALF_UP);
    }
}
