# 📋 Audit de Préparation à la Production — Version Décisions (50 utilisateurs)

**Contexte réel** : ~50 utilisateurs, pas 500. Le plan ci-dessous adapte les priorités de l'audit original en conséquence.

---

## ✅ P0 : Sécurité & Bloquants — VALIDÉ EN TOTALITÉ

Aucune réserve, ces points sont indépendants du nombre d'utilisateurs (une seule personne malveillante suffit à exploiter une IDOR ou un bypass d'auth).

| Tâche | Statut |
| :--- | :--- |
| Sécuriser Google Sign-In (validation cryptographique du token) | À faire |
| Supprimer les fallbacks `candidateId=1` et filtrer strictement par candidat (IDOR) | À faire |
| Traiter `IllegalArgumentException` / `IllegalStateException` en 400/409 | À faire |
| Externaliser les secrets, activer `jwt.cookie.secure=true` | À faire |

---

## ⚠️ P1 : Scalabilité — AJUSTÉ POUR 50 UTILISATEURS

| Tâche originale | Décision | Raison |
| :--- | :--- | :--- |
| Pagination `/opportunities` & `/applications` (N+1) | **Garder** | Bonne pratique peu coûteuse, indépendante du volume d'utilisateurs |
| Rate Limiting Bucket4j sur l'auth | **Garder** | Protection basique peu coûteuse à mettre en place |
| ~~Bascule Gemini vers Vertex AI (pay-as-you-go)~~ | **Ne pas faire** | Le quota gratuit (15 RPM) est largement suffisant à 50 utilisateurs ; reporté tant que le volume ne l'exige pas |
| ~~Remplacer SMTP Gmail par Brevo/SES~~ | **Ne pas faire** | Gmail SMTP tient la charge à ce niveau d'usage ; à revoir seulement en cas de blocage/blacklist observé |
| Pool Thread dédié pour l'envoi d'e-mails async | **Garder** | Correctif simple, évite de saturer le pool commun même à faible charge |
| Config HikariCP / index MySQL | **Garder, valeurs à ajuster à la baisse** | Les tailles de pool proposées (25-50) sont dimensionnées pour 500 users ; à réduire pour 50 (ex: 10-15 connexions max) |

---

## 🕓 P2 : Frontend & DevOps — REPORTÉ

| Domaine | Décision |
| :--- | :--- |
| Écrans mockés (Profil, Paramètres, Documents, Activité) | Reporté, à traiter plus tard |
| Dockerfiles, docker-compose.prod.yml | **Laissé de côté pour l'instant**, reste en local avec le compose actuel |
| Nginx reverse proxy | Reporté |
| Spring Boot Actuator, Sentry | Reporté |

---

## Roadmap révisée

```
Phase 1 — Sécurité (P0, inchangé)
  1. Google Sign-In sécurisé
  2. Suppression fallback candidateId=1 + filtrage IDOR
  3. GlobalExceptionHandler (400/409)
  4. Secrets externalisés + cookie secure

Phase 2 — Scalabilité légère (P1 réduit)
  5. Pagination Opportunities/Applications
  6. Rate limiting Bucket4j sur /auth
  7. Thread pool dédié pour les e-mails
  8. Ajustement HikariCP (pool réduit ~10-15) + index MySQL

Phase 3 — Reporté (à revoir plus tard si la volumétrie augmente)
  - Vertex AI / clés Gemini payantes
  - Remplacement SMTP
  - Docker / docker-compose / Nginx
  - Frontend mocké → vrais endpoints
  - Actuator / Sentry
```
