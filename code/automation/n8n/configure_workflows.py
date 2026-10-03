import json
import re
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
    lambda _: """SELECT cfg.target_role AS role, cfg.target_city AS city
FROM candidate_configuration cfg
WHERE cfg.search_enabled = 1
  AND TRIM(cfg.target_role) <> ''
  AND TRIM(cfg.target_city) <> ''
GROUP BY cfg.target_role, cfg.target_city;"""
)


def qualify(query):
    query = query.replace('        c.target_role,', '        cfg.target_role,')
    query = query.replace('        c.city AS candidate_city,', '        cfg.target_city AS candidate_city,')
    if 'cfg.daily_credit_budget,' not in query:
        query = query.replace('        cp.raw_data AS profile,', '        cp.raw_data AS profile,\n        cfg.daily_credit_budget,')
    if 'JOIN candidate_configuration cfg' not in query:
        query = query.replace('    FROM candidate c\n',
                              '    FROM candidate c\n    JOIN candidate_configuration cfg ON cfg.candidate_id = c.id\n')
    query = query.replace(
        "    WHERE JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.automation.searchEnabled')) = 'true'\n"
        "      AND c.target_role IS NOT NULL AND TRIM(c.target_role) <> ''\n"
        '      AND NOT EXISTS (',
        "    WHERE cfg.search_enabled = 1\n      AND TRIM(cfg.target_role) <> ''\n"
        "      AND TRIM(cfg.target_city) <> ''\n      AND NOT EXISTS ("
    )
    query = query.replace('    WHERE NOT EXISTS (',
                          "    WHERE cfg.search_enabled = 1\n      AND TRIM(cfg.target_role) <> ''\n"
                          "      AND TRIM(cfg.target_city) <> ''\n      AND NOT EXISTS (")
    return re.sub(r'WHERE candidate_offer_rank <= [^\n]+',
                  'WHERE candidate_offer_rank <= 10 * daily_credit_budget', query)


replace_query('[QUALIF] Score Offers.json', 'Load New Offers', qualify)


def gate_letters(query):
    base = "WHERE a.status = 'qualified' AND a.cover_letter_minio_key IS NULL"
    old_guard = (
        "AND JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.automation.searchEnabled')) = 'true' "
        "AND JSON_UNQUOTE(JSON_EXTRACT(cp.raw_data, '$.automation.coverLetterEnabled')) = 'true'"
    )
    guard = 'AND cfg.search_enabled = 1 AND cfg.cover_letter_enabled = 1'
    if 'JOIN candidate_configuration cfg' not in query:
        query = query.replace('JOIN candidate c ON c.id = a.candidate_id ',
                              'JOIN candidate c ON c.id = a.candidate_id '
                              'JOIN candidate_configuration cfg ON cfg.candidate_id = c.id ')
    before, after = query.split(base, 1)
    after = after.replace(old_guard, '').strip()
    after = after.replace(guard, '').strip()
    return before + base + ' ' + guard + (' ' + after if after else '')


replace_query('[CANDIDATURE] Generate Cover Letter.json', 'Load Qualified Applications', gate_letters)

path = root / '[CORE] Orchestrator.json'
content = path.read_text(encoding='utf-8')
if '"hoursInterval": 6' in content:
    content = content.replace('"hoursInterval": 6', '"hoursInterval": 24', 1)
    content = content.replace('Cron Every 6h', 'Cron Daily')
    path.write_text(content, encoding='utf-8')
