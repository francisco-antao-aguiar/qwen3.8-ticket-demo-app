package com.ticketshop.dto;

import jakarta.validation.constraints.NotBlank;

public record PaymentRequest(
        @NotBlank String buyerName,
        @NotBlank String cardNumber,
        @NotBlank String cardExpiry,
        @NotBlank String cardCvv
) {
}
