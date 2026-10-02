package com.ticketshop.repository;

import com.ticketshop.model.Seat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.List;

public interface SeatRepository extends JpaRepository<Seat, Long> {

    List<Seat> findByConcertIdOrderByRowLetterAscSeatNumberAsc(Long concertId);

    /**
     * Loads the given seats with a pessimistic write lock (SELECT ... FOR UPDATE),
     * so a concurrent order for the same seats blocks until our transaction finishes.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Seat s where s.id in :ids")
    List<Seat> lockByIds(@Param("ids") List<Long> ids);
}
