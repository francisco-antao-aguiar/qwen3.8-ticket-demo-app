package com.ticketshop.controller;

import com.ticketshop.dto.ArtistDto;
import com.ticketshop.repository.ArtistRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ArtistController {

    private final ArtistRepository artistRepository;

    public ArtistController(ArtistRepository artistRepository) {
        this.artistRepository = artistRepository;
    }

    @GetMapping("/artists")
    public List<ArtistDto> listArtists() {
        return artistRepository.findAll().stream()
                .map(ArtistDto::from)
                .toList();
    }
}
