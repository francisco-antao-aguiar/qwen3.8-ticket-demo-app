package com.ticketshop.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record PaymentResponse(
        String paymentId,
        String status, // APPROVED | DECLINED
        String last4,
        String declineReason
) {

    public static PaymentResponse approved(String paymentId, String last4) {
        return new PaymentResponse(paymentId, "APPROVED", last4, null);
    }

    public static PaymentResponse declined(String reason) {
        return new PaymentResponse(null, "DECLINED", null, reason);
    }
}
