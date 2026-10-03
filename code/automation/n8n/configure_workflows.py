import json
from pathlib import Path

root = Path(__file__).resolve().parents[2] / 'workflows/json-workflows/emploi'


def replace_query(filename, node_name, transform):
    path = root / filename
    content = path.read_text(encoding='utf-8')
    workflow = json.loads(content)
    node = next(node for node in workflow['nodes'] if node['name'] == node_name)
    old_query = node['parameters']['query']
    new_query = transform(old_query)
    if old_query == new_query:
        return
    old_literal = json.dumps(old_query, ensure_ascii=False)
    new_literal = json.dumps(new_query, ensure_ascii=False)
    assert content.count(old_literal) == 1, filename
    path.write_text(content.replace(old_literal, new_literal, 1), encoding='utf-8')


replace_query(
    '[OFFRES] Search All Platforms - Company Fallback.json',
    'Load Search Params',
    lambda _: """SELECT c.target_role AS role, c.city AS city
FROM candidate c
JOIN candidate_profile cp ON cp.candidate_id = c.id
WHERE c.target_role IS NOT NULL AND TRIM(c.target_role) <> ''
  AND c.city IS NOT NULL AND TRIM(c.city) <> ''
  AND JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.automation.searchEnabled')) = 'true'
GROUP BY c.target_role, c.city;"""
)


def qualify(query):
    query = query.replace(
        '    WHERE NOT EXISTS (',
        "    WHERE JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.automation.searchEnabled')) = 'true'\n"
        "      AND c.target_role IS NOT NULL AND TRIM(c.target_role) <> ''\n"
        '      AND NOT EXISTS ('
    )
    return query.replace(
        'WHERE candidate_offer_rank <= 50',
        "WHERE candidate_offer_rank <= 10 * LEAST(5, GREATEST(1, COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(profile, '$.automation.dailyCreditBudget')) AS UNSIGNED), 1)))"
    )


replace_query('[QUALIF] Score Offers.json', 'Load New Offers', qualify)


def gate_letters(query):
    base = "WHERE a.status = 'qualified' AND a.cover_letter_minio_key IS NULL"
    guard = (
        "AND JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.automation.searchEnabled')) = 'true' "
        "AND JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.automation.coverLetterEnabled')) = 'true'"
    )
    before, after = query.split(base, 1)
    after = after.replace(guard, '').strip()
    return before + base + ' ' + guard + (' ' + after if after else '')


replace_query('[CANDIDATURE] Generate Cover Letter.json', 'Load Qualified Applications', gate_letters)

path = root / '[CORE] Orchestrator.json'
content = path.read_text(encoding='utf-8')
if '"hoursInterval": 6' in content:
    content = content.replace('"hoursInterval": 6', '"hoursInterval": 24', 1)
    content = content.replace('Cron Every 6h', 'Cron Daily')
    path.write_text(content, encoding='utf-8')
