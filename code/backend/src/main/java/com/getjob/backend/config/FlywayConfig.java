package com.getjob.backend.config;

import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlywayConfig {

    @org.springframework.beans.factory.annotation.Value("${spring.flyway.repair-on-migrate:false}")
    private boolean repairOnMigrate;

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            if (repairOnMigrate) {
                flyway.repair();
            }
            flyway.migrate();
        };
    }
}
