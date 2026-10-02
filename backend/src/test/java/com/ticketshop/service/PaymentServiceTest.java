package com.ticketshop.service;

import com.ticketshop.dto.PaymentRequest;
import com.ticketshop.dto.PaymentResponse;
import org.junit.jupiter.api.Test;

import java.time.YearMonth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit tests for the mock payment gateway rules:
 * 13-19 digits (spaces/dashes ignored), cards ending in 0000 are declined,
 * expiry MM/YY and not in the past, CVV 3-4 digits.
 */
class PaymentServiceTest {

    private final PaymentService service = new PaymentService();

    /** Expiry MM/YY that is always in the future, no matter when the tests run. */
    private static String futureExpiry(int monthsFromNow) {
        YearMonth m = YearMonth.now().plusMonths(monthsFromNow);
        return String.format("%02d/%02d", m.getMonthValue(), m.getYear() % 100);
    }

    private static PaymentRequest request(String cardNumber, String expiry, String cvv) {
        return new PaymentRequest("Jane Doe", cardNumber, expiry, cvv);
    }

    @Test
    void approvesValidCard() {
        PaymentResponse response = service.process(request("4242 4242 4242 4242", futureExpiry(24), "123"));

        assertEquals("APPROVED", response.status());
        assertNull(response.declineReason());
        assertEquals("4242", response.last4());
        assertTrue(response.paymentId().startsWith("pay_"),
                "paymentId should look like pay_<hex>, got: " + response.paymentId());
    }

    @Test
    void stripsSpacesAndDashesBeforeValidating() {
        PaymentResponse response = service.process(request("4242-4242-4242-4242", futureExpiry(24), "1234"));

        assertEquals("APPROVED", response.status());
        assertEquals("4242", response.last4());
    }

    @Test
    void approves13And19DigitCards() {
        assertEquals("APPROVED", service.process(request("4222222222222", futureExpiry(24), "123")).status());
        assertEquals("APPROVED", service.process(request("4111111111111111111", futureExpiry(24), "123")).status());
    }

    @Test
    void declinesCardNumberShorterThan13Digits() {
        PaymentResponse response = service.process(request("4242 4242 424", futureExpiry(24), "123"));

        assertEquals("DECLINED", response.status());
        assertEquals("Card number is invalid.", response.declineReason());
        assertNull(response.paymentId());
        assertNull(response.last4());
    }

    @Test
    void declinesCardNumberLongerThan19Digits() {
        PaymentResponse response = service.process(request("41111111111111111111", futureExpiry(24), "123"));

        assertEquals("DECLINED", response.status());
        assertEquals("Card number is invalid.", response.declineReason());
    }

    @Test
    void declinesCardNumberContainingLetters() {
        PaymentResponse response = service.process(request("4242 4242 4242 42L2", futureExpiry(24), "123"));

        assertEquals("DECLINED", response.status());
        assertEquals("Card number is invalid.", response.declineReason());
    }

    @Test
    void declinesCardEndingIn0000EvenIfOtherwiseValid() {
        PaymentResponse response = service.process(request("4242 4242 4242 0000", futureExpiry(24), "123"));

        assertEquals("DECLINED", response.status());
        assertTrue(response.declineReason().contains("declined by issuer"));
    }

    @Test
    void declinesMalformedExpiry() {
        assertEquals("Card expiry is invalid (use MM/YY).",
                service.process(request("4242424242424242", "13/29", "123")).declineReason());
        assertEquals("Card expiry is invalid (use MM/YY).",
                service.process(request("4242424242424242", "00/29", "123")).declineReason());
        assertEquals("Card expiry is invalid (use MM/YY).",
                service.process(request("4242424242424242", "1229", "123")).declineReason());
        assertEquals("Card expiry is invalid (use MM/YY).",
                service.process(request("4242424242424242", "12/2029", "123")).declineReason());
    }

    @Test
    void declinesExpiredCard() {
        YearMonth past = YearMonth.now().minusMonths(1);
        String pastExpiry = String.format("%02d/%02d", past.getMonthValue(), past.getYear() % 100);

        PaymentResponse response = service.process(request("4242424242424242", pastExpiry, "123"));

        assertEquals("DECLINED", response.status());
        assertEquals("Card is expired.", response.declineReason());
    }

    @Test
    void declinesCvvShorterThan3Digits() {
        assertEquals("CVV is invalid.",
                service.process(request("4242424242424242", futureExpiry(24), "12")).declineReason());
    }

    @Test
    void declinesCvvLongerThan4Digits() {
        assertEquals("CVV is invalid.",
                service.process(request("4242424242424242", futureExpiry(24), "12345")).declineReason());
    }

    @Test
    void declinesCvvContainingLetters() {
        assertEquals("CVV is invalid.",
                service.process(request("4242424242424242", futureExpiry(24), "12a")).declineReason());
    }
}
