package com.ticketshop.service;

import com.ticketshop.dto.PaymentRequest;
import com.ticketshop.dto.PaymentResponse;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.YearMonth;
import java.util.HexFormat;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Mock payment processor. Always "succeeds" unless:
 *  - the card fails basic format validation, or
 *  - the card number ends in 0000 (deterministic decline for testing).
 */
@Service
public class PaymentService {

    private static final SecureRandom RANDOM = new SecureRandom();
    /** Simulated gateway latency so the UI can show a "processing" state. */
    private static final long SIMULATED_LATENCY_MS = 1100;

    public PaymentResponse process(PaymentRequest request) {
        String digits = request.cardNumber().replaceAll("[\\s-]", "");

        if (!digits.matches("\\d{13,19}")) {
            return PaymentResponse.declined("Card number is invalid.");
        }
        if (digits.endsWith("0000")) {
            return PaymentResponse.declined("Card declined by issuer (test decline card).");
        }

        if (!request.cardExpiry().matches("(0[1-9]|1[0-2])/\\d{2}")) {
            return PaymentResponse.declined("Card expiry is invalid (use MM/YY).");
        }
        if (isExpired(request.cardExpiry())) {
            return PaymentResponse.declined("Card is expired.");
        }

        if (!request.cardCvv().matches("\\d{3,4}")) {
            return PaymentResponse.declined("CVV is invalid.");
        }

        try {
            Thread.sleep(SIMULATED_LATENCY_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return PaymentResponse.declined("Payment could not be processed. Please retry.");
        }

        return PaymentResponse.approved("pay_" + HexFormat.of().formatHex(randomBytes(8)), digits.substring(digits.length() - 4));
    }

    private boolean isExpired(String mmYy) {
        int month = Integer.parseInt(mmYy.substring(0, 2));
        int year = 2000 + Integer.parseInt(mmYy.substring(3));
        return YearMonth.of(year, month).isBefore(YearMonth.now());
    }

    private byte[] randomBytes(int n) {
        byte[] bytes = new byte[n];
        RANDOM.nextBytes(bytes);
        return bytes;
    }
}
