# Préférences candidat pour n8n

La page Paramètres enregistre `candidate.target_role`, `candidate.city`, `candidate.whatsapp_number` et, dans `candidate_profile.raw_data`, `salaryExpectations` et `automation`.

`automation` contient `searchEnabled`, `coverLetterEnabled`, `autoApplyEnabled`, `whatsappEnabled`, `dailyCreditBudget` (entier de 1 à 5), `mailboxProvider`, `mailboxAddress` et `mailboxConnected`. Tous les interrupteurs sont désactivés par défaut. `mailboxConnected` est toujours `false` tant qu'une vraie autorisation de messagerie n'est pas implémentée ; le formulaire ne peut pas le modifier.

Le dossier historique `workflows/` est ignoré par Git. Pour appliquer les adaptations locales aux exports n8n présents dans ce dossier :

```bash
python automation/n8n/configure_workflows.py
```

Le script est rejouable et ne modifie que quatre exports :

- Le déclencheur principal passe d'un intervalle de 6 h à 24 h.
- La collecte des offres ne charge que les postes et villes des candidats ayant activé la recherche.
- La qualification ne traite que ces candidats et limite le nombre d'offres à `10 × dailyCreditBudget` par candidat et par exécution.
- La génération automatique des lettres est limitée aux candidats qui ont activé la recherche et la rédaction.

Ces exports doivent encore être importés dans n8n pour agir sur un workflow actif. Le budget exprime une limite d'effort ; aucun prélèvement de crédit de recherche n'est implémenté. L'envoi automatique de candidatures, la connexion OAuth de la boîte mail et les notifications WhatsApp demandent encore leurs workflows et autorisations. Ne jamais envoyer de candidature uniquement parce que `autoApplyEnabled` vaut `true` : exiger aussi une connexion de messagerie validée et une adresse de contact qualifiée.
