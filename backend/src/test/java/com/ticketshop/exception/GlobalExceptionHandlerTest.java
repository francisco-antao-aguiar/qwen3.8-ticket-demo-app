package com.ticketshop.exception;

import com.ticketshop.controller.OrderController;
import com.ticketshop.dto.CreateOrderRequest;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.validation.AbstractBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.lang.reflect.Method;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Unit tests for {@link GlobalExceptionHandler}: each domain exception is
 * mapped to a single-element JSON body of the form {"error": "..."}.
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void seatUnavailableBecomesConflictBody() {
        Map<String, String> body =
                handler.handleSeatUnavailable(new SeatUnavailableException("Seat(s) already sold: [7, 8]"));

        assertEquals(Map.of("error", "Seat(s) already sold: [7, 8]"), body);
    }

    @Test
    void notFoundBecomesNotFoundBody() {
        Map<String, String> body =
                handler.handleNotFound(new NotFoundException("Concert not found: 42"));

        assertEquals(Map.of("error", "Concert not found: 42"), body);
    }

    @Test
    void illegalArgumentBecomesBadRequestBody() {
        Map<String, String> body =
                handler.handleIllegalArgument(new IllegalArgumentException("One or more seats do not exist."));

        assertEquals(Map.of("error", "One or more seats do not exist."), body);
    }

    @Test
    void validationErrorsAreJoinedPerField() {
        MethodArgumentNotValidException ex = validationError(
                "buyerName", "must not be blank",
                "buyerEmail", "must be a valid email address");

        Map<String, String> body = handler.handleValidation(ex);

        assertEquals(Map.of("error", "buyerName: must not be blank; buyerEmail: must be a valid email address"), body);
    }

    @Test
    void validationErrorWithSingleField() {
        MethodArgumentNotValidException ex = validationError("seatIds", "size must be between 1 and 4");

        Map<String, String> body = handler.handleValidation(ex);

        assertEquals(Map.of("error", "seatIds: size must be between 1 and 4"), body);
    }

    private static MethodArgumentNotValidException validationError(String... fieldAndMessagePairs) {
        TestBindingResult result = new TestBindingResult();
        for (int i = 0; i < fieldAndMessagePairs.length; i += 2) {
            // FieldError(objectName, field, defaultMessage)
            result.addError(new FieldError("orderRequest", fieldAndMessagePairs[i], fieldAndMessagePairs[i + 1]));
        }
        try {
            Method method = OrderController.class.getDeclaredMethod("createOrder", CreateOrderRequest.class);
            return new MethodArgumentNotValidException(new MethodParameter(method, 0), result);
        } catch (NoSuchMethodException e) {
            throw new AssertionError("OrderController#createOrder must exist", e);
        }
    }

    /** Minimal {@link org.springframework.validation.BindingResult} for tests. */
    private static class TestBindingResult extends AbstractBindingResult {

        TestBindingResult() {
            super("orderRequest");
        }

        @Override
        public Object getTarget() {
            return new Object();
        }

        @Override
        protected Object getActualFieldValue(String field) {
            return null;
        }
    }
}
