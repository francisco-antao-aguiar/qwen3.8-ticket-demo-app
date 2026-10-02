package com.ticketshop.dto;

import com.ticketshop.model.Artist;

public record ArtistDto(Long id, String name) {

    public static ArtistDto from(Artist artist) {
        return new ArtistDto(artist.getId(), artist.getName());
    }
}
