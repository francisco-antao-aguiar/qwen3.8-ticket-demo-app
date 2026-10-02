package com.ticketshop;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class TicketShopApplication {

    public static void main(String[] args) {
        SpringApplication.run(TicketShopApplication.class, args);
    }
}
