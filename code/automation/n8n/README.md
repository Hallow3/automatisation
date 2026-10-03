# Préférences candidat pour n8n

La page Paramètres enregistre les choix dans `candidate_configuration`, une table avec `candidate_id` comme clé primaire et clé étrangère vers `candidate(id)`. La migration Flyway V15 reprend les valeurs qui existaient dans `candidate` et `candidate_profile.raw_data`. Le profil et les paramètres lisent ensuite la même ligne de configuration. Les colonnes historiques de `candidate` restent synchronisées pour les anciens usages.

La table contient le poste, la ville, les prétentions, le numéro WhatsApp, les notifications et les préférences d'automatisation, dont `daily_credit_budget` (1 à 5). Tous les interrupteurs d'automatisation sont désactivés par défaut. `mailbox_connected` ne peut pas être modifié par le formulaire ; une adresse saisie n'autorise aucun envoi.

Le dossier historique `workflows/` est ignoré par Git. Pour appliquer les adaptations locales aux exports n8n présents dans ce dossier :

```bash
python automation/n8n/configure_workflows.py
```

Le script est rejouable et ne modifie que quatre exports :

- Le déclencheur principal passe d'un intervalle de 6 h à 24 h.
- La collecte des offres ne charge que les postes et villes des candidats ayant activé la recherche dans `candidate_configuration`.
- La qualification ne traite que ces candidats et limite le nombre d'offres à `10 × dailyCreditBudget` par candidat et par exécution.
- La génération automatique des lettres est limitée aux candidats qui ont activé la recherche et la rédaction.

Ces exports doivent encore être importés dans n8n pour agir sur un workflow actif. Le budget exprime une limite d'effort ; aucun prélèvement de crédit de recherche n'est implémenté. L'envoi automatique de candidatures, la connexion OAuth de la boîte mail et les notifications WhatsApp demandent encore leurs workflows et autorisations. Ne jamais envoyer de candidature uniquement parce que `autoApplyEnabled` vaut `true` : exiger aussi une connexion de messagerie validée et une adresse de contact qualifiée.
