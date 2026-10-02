package com.ticketshop.service;

import com.ticketshop.dto.OrderResponse;
import com.ticketshop.model.Order;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;

/**
 * Sends order-confirmation emails via SMTP (local Mailpit/MailHog by default).
 * Runs asynchronously; a mail failure is logged and never fails the order.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;

    @Value("${ticketshop.mail.from:TicketShop <no-reply@ticketshop.local>}")
    private String fromAddress;

    @Value("${ticketshop.mail.bcc:}")
    private String bccAddress;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Async
    public void sendOrderConfirmation(Order order) {
        OrderResponse dto = OrderResponse.from(order);
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(dto.buyerEmail());
            if (bccAddress != null && !bccAddress.isBlank()) {
                helper.setBcc(bccAddress.trim());
            }
            helper.setSubject("🎟️ Your tickets are confirmed — " + dto.reference());
            helper.setText(buildHtml(dto), true);
            mailSender.send(message);
            log.info("Confirmation email for order {} sent to {} (bcc {})",
                    dto.reference(), dto.buyerEmail(), bccAddress);
        } catch (Exception e) {
            log.error("Failed to send confirmation email for order {} (is Mailpit/MailHog running on port 1025?)",
                    dto.reference(), e);
        }
    }

    private String buildHtml(OrderResponse order) {
        var concert = order.concert();

        StringBuilder seats = new StringBuilder();
        for (OrderResponse.OrderSeatDto seat : order.seats()) {
            seats.append("<tr>")
                    .append("<td style=\"padding:4px 24px 4px 0;font-weight:600;\">Row ").append(seat.rowLetter())
                    .append(" · seat ").append(seat.seatNumber()).append("</td>")
                    .append("<td style=\"padding:4px 12px 4px 0;color:#6b7280;\">").append(seat.zone()).append("</td>")
                    .append("<td style=\"padding:4px 0;text-align:right;font-weight:600;\">")
                    .append(String.format("%.2f", seat.price())).append(" USD</td>")
                    .append("</tr>");
        }

        return """
                <!DOCTYPE html>
                <html>
                <body style="margin:0;padding:24px;background:#0b1120;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
                    <div style="background:linear-gradient(135deg,#7c3aed,#db2777);padding:20px 28px;color:#ffffff;">
                      <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85;">TicketShop</div>
                      <div style="font-size:20px;font-weight:bold;margin-top:6px;">Your tickets are confirmed! 🎉</div>
                    </div>
                    <div style="padding:24px 28px;">
                      <p style="margin:0 0 18px;font-size:14px;">Hi %s,</p>

                      <table style="width:100%%;font-size:14px;margin-bottom:18px;">
                        <tr><td style="padding:3px 0;color:#6b7280;width:130px;">Event</td>
                            <td style="padding:3px 0;font-weight:bold;">%s — %s</td></tr>
                        <tr><td style="padding:3px 0;color:#6b7280;">Date</td>
                            <td style="padding:3px 0;">%s</td></tr>
                        <tr><td style="padding:3px 0;color:#6b7280;">Venue</td>
                            <td style="padding:3px 0;">%s</td></tr>
                        <tr><td style="padding:3px 0;color:#6b7280;">Order ref</td>
                            <td style="padding:3px 0;font-family:monospace;font-weight:bold;">%s</td></tr>
                        <tr><td style="padding:3px 0;color:#6b7280;">Buyer</td>
                            <td style="padding:3px 0;">%s &lt;%s&gt;</td></tr>
                      </table>

                      <div style="background:#f3f4f6;border-radius:8px;padding:14px 18px;margin-bottom:18px;">
                        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6b7280;margin-bottom:8px;">Your seats</div>
                        <table style="width:100%%;font-size:14px;">%s
                          <tr><td colspan="2" style="padding:8px 12px 0 0;border-top:1px solid #d1d5db;text-align:right;font-weight:bold;">
                            Total: %s USD</td></tr>
                        </table>
                      </div>

                      <p style="margin:0;font-size:12px;color:#6b7280;">
                        Show the order reference at the venue entrance. This is an automated message — do not reply.
                      </p>
                    </div>
                    <div style="background:#f9fafb;padding:12px 28px;font-size:11px;color:#9ca3af;">
                      TicketShop · demo order confirmation
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(
                esc(order.buyerName()),
                esc(concert.title()), esc(concert.artistName()),
                esc(concert.date()), esc(concert.venue()),
                esc(order.reference()),
                esc(order.buyerName()), esc(order.buyerEmail()),
                seats.toString(),
                String.format("%.2f", order.totalAmount())
        );
    }

    private static String esc(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
