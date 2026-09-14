package com.getjob.backend.payment.repository;

import com.getjob.backend.payment.domain.NotchPayWebhookEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface NotchPayWebhookEventRepository extends JpaRepository<NotchPayWebhookEventEntity, String> {
    boolean existsByEventId(String eventId);
    Optional<NotchPayWebhookEventEntity> findByEventId(String eventId);
}
