package com.getjob.backend.payment.repository;

import com.getjob.backend.payment.domain.PaymentStatus;
import com.getjob.backend.payment.domain.PaymentTransactionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransactionEntity, Long> {
    Optional<PaymentTransactionEntity> findByReference(String reference);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT t FROM PaymentTransactionEntity t WHERE t.reference = :reference")
    Optional<PaymentTransactionEntity> findByReferenceForUpdate(@org.springframework.data.repository.query.Param("reference") String reference);

    List<PaymentTransactionEntity> findByCandidateIdOrderByCreatedAtDesc(Integer candidateId);
    List<PaymentTransactionEntity> findByCandidateIdAndStatusOrderByCreatedAtDesc(Integer candidateId, PaymentStatus status);
}
