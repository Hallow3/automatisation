-- Migration V14: Nettoyage des sessions orphelines et régularisation des crédits interrompus
-- 1. Nettoyage des sessions d'entretien orphelines restées en 'IN_PROGRESS' depuis plus d'1 heure
UPDATE cv 
SET interview_status = 'ABORTED' 
WHERE interview_status = 'IN_PROGRESS' 
  AND (updated_at < DATE_SUB(NOW(), INTERVAL 1 HOUR) OR updated_at IS NULL);

-- 2. Restitution d'1 crédit aux candidats ayant subi une interruption technique (session ABORTED) et dont le solde est tombé à 0 sans CV finalisé
UPDATE candidate c
SET c.pro_credits = COALESCE(c.pro_credits, 0) + 1
WHERE c.pro_credits = 0
  AND EXISTS (
      SELECT 1 FROM cv WHERE cv.candidate_id = c.id AND cv.interview_status = 'ABORTED'
  )
  AND NOT EXISTS (
      SELECT 1 FROM cv WHERE cv.candidate_id = c.id AND cv.interview_status = 'COMPLETED'
  );
