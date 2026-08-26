package com.getjob.backend.auth.service;

import com.getjob.backend.candidate.domain.CandidateEntity;
import com.getjob.backend.candidate.repository.CandidateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Implémentation de UserDetailsService pour Spring Security.
 *
 * Spring Security appelle loadUserByUsername(email) pour :
 *   1. vérifier le mot de passe au login
 *   2. charger l'utilisateur depuis le token JWT à chaque requête protégée
 *
 * L'identifiant utilisé est l'email (= username dans le contexte Spring).
 */
@Service
@RequiredArgsConstructor
public class CandidateUserDetailsService implements UserDetailsService {

    private final CandidateRepository candidateRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        CandidateEntity candidate = candidateRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "Aucun compte trouvé pour l'email : " + email));

        return User.builder()
                .username(candidate.getEmail())
                .password(candidate.getPasswordHash() != null ? candidate.getPasswordHash() : "")
                .authorities(List.of(new SimpleGrantedAuthority(candidate.getRole())))
                .accountExpired(false)
                .accountLocked(!candidate.isEnabled())
                .credentialsExpired(false)
                .disabled(!candidate.isEnabled())
                .build();
    }
}
