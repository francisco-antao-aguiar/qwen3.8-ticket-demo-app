package com.ticketshop.repository;

import com.ticketshop.model.Concert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ConcertRepository extends JpaRepository<Concert, Long> {

    List<Concert> findByOrderByDateAsc();

    List<Concert> findByArtistIdOrderByDateAsc(Long artistId);
}
