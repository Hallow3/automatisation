package com.getjob.backend.auth.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import org.springframework.scheduling.annotation.Scheduled;

import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

/**
 * Filtre de limitation de débit (Rate Limiter) léger en mémoire.
 * Protège les endpoints sensibles d'authentification et de génération IA contre les attaques par force brute / abus.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    private final ObjectMapper objectMapper;

    // Limite : 15 requêtes par minute par adresse IP
    private static final int MAX_REQUESTS_PER_MINUTE = 15;
    private static final long WINDOW_MS = 60_000L;
    private static final long EVICTION_EXPIRY_MS = 3_600_000L; // 1 heure

    private static final Pattern AI_CVS_PATTERN = Pattern.compile("^/api/v1/cvs/(\\d+/)?(interview/session|ai-edit|synthesize)$");

    private static class RequestCounter {
        long windowStart;
        AtomicInteger count;

        RequestCounter(long start) {
            this.windowStart = start;
            this.count = new AtomicInteger(1);
        }
    }

    private final Map<String, RequestCounter> requestCounts = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String path = request.getRequestURI();
        String method = request.getMethod();

        if ("POST".equalsIgnoreCase(method) && isRateLimitedPath(path)) {
            String clientIp = getClientIp(request);
            long now = System.currentTimeMillis();

            RequestCounter counter = requestCounts.compute(clientIp, (key, existing) -> {
                if (existing == null || (now - existing.windowStart) > WINDOW_MS) {
                    return new RequestCounter(now);
                }
                existing.count.incrementAndGet();
                return existing;
            });

            if (counter.count.get() > MAX_REQUESTS_PER_MINUTE) {
                log.warn("🚨 Rate limit dépassé pour l'IP {} sur {}", clientIp, path);
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);

                ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                        HttpStatus.TOO_MANY_REQUESTS,
                        "Trop de requêtes effectuées. Veuillez patienter une minute avant de réessayer."
                );
                problem.setTitle("Too Many Requests");
                problem.setType(URI.create("urn:problem-type:rate-limit-exceeded"));
                problem.setProperty("timestamp", Instant.now());

                response.getWriter().write(objectMapper.writeValueAsString(problem));
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Purge périodique (toutes les heures) pour éviter toute fuite de mémoire.
     */
    @Scheduled(fixedRate = 3600000)
    public void evictExpiredCounters() {
        long now = System.currentTimeMillis();
        requestCounts.entrySet().removeIf(entry -> (now - entry.getValue().windowStart) > EVICTION_EXPIRY_MS);
        log.debug("Nettoyage RateLimitFilter effectué. Entrées actives : {}", requestCounts.size());
    }

    private boolean isRateLimitedPath(String path) {
        if (path == null) return false;
        return path.startsWith("/api/v1/auth/login") ||
               path.startsWith("/api/v1/auth/register") ||
               path.startsWith("/api/v1/auth/verify-email") ||
               path.startsWith("/api/v1/auth/resend-verification") ||
               path.startsWith("/api/v1/auth/forgot-password") ||
               path.startsWith("/api/v1/auth/reset-password") ||
               path.startsWith("/api/v1/auth/google") ||
               path.startsWith("/api/v1/voice/session") ||
               path.equals("/api/v1/cvs/import") ||
               AI_CVS_PATTERN.matcher(path).matches();
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String clientIp = xff.split(",")[0].trim();
            if (!clientIp.isBlank()) {
                return clientIp;
            }
        }
        String remoteAddr = request.getRemoteAddr();
        return (remoteAddr != null && !remoteAddr.isBlank()) ? remoteAddr : "unknown";
    }
}
