package com.ticketshop.controller;

import com.ticketshop.dto.ConcertDto;
import com.ticketshop.dto.SeatDto;
import com.ticketshop.dto.SeatMapResponse;
import com.ticketshop.exception.NotFoundException;
import com.ticketshop.model.Concert;
import com.ticketshop.repository.ConcertRepository;
import com.ticketshop.repository.SeatRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/concerts")
public class ConcertController {

    private final ConcertRepository concertRepository;
    private final SeatRepository seatRepository;

    public ConcertController(ConcertRepository concertRepository, SeatRepository seatRepository) {
        this.concertRepository = concertRepository;
        this.seatRepository = seatRepository;
    }

    @GetMapping
    public List<ConcertDto> listConcerts(@RequestParam(required = false) Long artistId) {
        List<Concert> concerts = (artistId == null)
                ? concertRepository.findByOrderByDateAsc()
                : concertRepository.findByArtistIdOrderByDateAsc(artistId);
        return concerts.stream().map(ConcertDto::from).toList();
    }

    @GetMapping("/{id}/seats")
    public SeatMapResponse getSeatMap(@PathVariable Long id) {
        Concert concert = concertRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Concert not found: " + id));
        List<SeatDto> seats = seatRepository
                .findByConcertIdOrderByRowLetterAscSeatNumberAsc(concert.getId())
                .stream()
                .map(SeatDto::from)
                .toList();
        return new SeatMapResponse(ConcertDto.from(concert), seats);
    }
}
