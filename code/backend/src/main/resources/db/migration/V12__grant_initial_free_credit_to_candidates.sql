-- Migration V12: Modification du défaut de pro_credits à 1 et attribution du crédit de bienvenue
ALTER TABLE candidate MODIFY COLUMN pro_credits INT NOT NULL DEFAULT 1;

-- Attribuer 1 crédit de bienvenue aux candidats ayant actuellement 0 crédit et aucune transaction payante réussie
UPDATE candidate 
SET pro_credits = 1 
WHERE pro_credits = 0 
  AND NOT EXISTS (
      SELECT 1 
      FROM payment_transaction pt 
      WHERE pt.candidate_id = candidate.id 
        AND pt.status = 'SUCCESS'
  );
