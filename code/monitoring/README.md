# Monitoring FallaJobs en production

Les vues des entretiens IA, des routes HTTP et des logs par service sont décrites dans [OBSERVABILITY.md](OBSERVABILITY.md).

Le déploiement utilise Grafana, Prometheus, Loki et Grafana Alloy dans le réseau Docker privé `app-network`. Grafana est servi sous `https://fallajobs.com/monitoring/`; Prometheus, Loki, Alloy et node-exporter n'exposent aucun port public.

## Déploiement

Créer sur le serveur `monitoring/monitoring.env` avec `GF_SECURITY_ADMIN_USER` et `GF_SECURITY_ADMIN_PASSWORD`, puis créer `monitoring/secrets/metrics-token` avec un jeton aléatoire d'au moins 32 octets. Garder ces fichiers hors Git et limiter leurs permissions à root. Ajouter le même jeton dans `backend/.env` sous `MONITORING_METRICS_TOKEN`.

```sh
docker compose -f docker-compose.yml -f monitoring/docker-compose.yml config
docker compose -f docker-compose.yml -f monitoring/docker-compose.yml up -d --build
```

Le timer systemd `fallajobs-container-metrics.timer` collecte toutes les 30 secondes les états Docker vers le textfile collector node-exporter. Il s'exécute sur l'hôte; aucun conteneur n'a accès au socket Docker.

## Mesures

- Les utilisateurs inscrits et vérifiés sont des comptes actuels lus depuis la base. « Vérifié » correspond à `enabled=true`.
- Une inscription réussie est une réponse HTTP 2xx de `POST /api/v1/auth/register`; les réponses 4xx/5xx sont les échecs. Les mesures commencent après le déploiement et les compteurs repartent à zéro si le backend redémarre.
- Les logs proviennent des fichiers JSON Docker et sont conservés sept jours. Ils peuvent contenir des données personnelles présentes dans les logs applicatifs; limiter l'accès Grafana aux personnes autorisées.
- Prometheus conserve les séries quinze jours.

Le dashboard est provisionné automatiquement et ne peut pas être supprimé depuis l'interface.
