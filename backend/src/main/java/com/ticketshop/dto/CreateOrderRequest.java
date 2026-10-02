package com.ticketshop.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateOrderRequest(
        @NotBlank String buyerName,
        @NotBlank @Email String buyerEmail,
        @NotNull Long concertId,
        @NotNull @Size(min = 1, max = 4) List<Long> seatIds
) {
}
