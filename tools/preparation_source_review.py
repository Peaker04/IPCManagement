"""Private, read-only evidence discovery. Candidates are never import acceptance.

Only stdlib is used. This tool never opens a database and never edits a workbook.
"""
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
GROUPS = {'PRODUCE', 'FRESH_MEAT', 'FRESH_SEAFOOD', 'FROZEN', 'SEASONING', 'RICE', 'NOODLES', 'EGGS', 'DAIRY', 'BAKERY', 'BEVERAGES', 'PACKAGING', 'ICE', 'OTHER', 'UNCLASSIFIED'}
SOURCES = {
    'IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx': '4a91f9ea847068abeb147eff7ed7401b029d698f73e495641099dd9fa552bc88',
    'IPC. Định lượng 07.2026.xlsx': 'a1459b87292514adff234c6ec8258b7ff54f68319a96533b0ba489e0b57bf403',
}


def norm(value):
    return ' '.join(unicodedata.normalize('NFC', str(value or '')).split()).casefold()


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def _xml(z, name):
    data = z.read(name)
    markup = data.replace(b'\x00', b'').upper()
    if b'<!DOCTYPE' in markup or b'<!ENTITY' in markup:
        raise ValueError('DTD/entities are not allowed')
    return ET.fromstring(data)


def _column(value):
    number = 0
    for c in value:
        number = number * 26 + ord(c) - 64
    return number


def _address(value):
    m = re.fullmatch(r'([A-Z]{1,3})([1-9][0-9]{0,6})', value)
    if not m or _column(m[1]) > 16384 or int(m[2]) > 1048576:
        raise ValueError('Invalid worksheet address')
    return m[1], int(m[2])


def _rows(z, target, shared):
    doc = _xml(z, target)
    rows, origins = {}, {}
    for row in doc.findall('s:sheetData/s:row', NS):
        for cell in row.findall('s:c', NS):
            address = cell.attrib.get('r', '')
            col, rn = _address(address)
            if cell.attrib.get('t') == 'inlineStr':
                value = ''.join(t.text or '' for t in cell.findall('.//s:t', NS))
            else:
                value = cell.findtext('s:v', '', NS)
                if cell.attrib.get('t') == 's':
                    if not value.isdigit() or int(value) >= len(shared):
                        raise ValueError('Invalid shared string index')
                    value = shared[int(value)]
            if col in rows.setdefault(rn, {}):
                raise ValueError('Duplicate cell address')
            rows[rn][col] = value.strip()
    if len(rows) > 100000:
        raise ValueError('Worksheet row limit exceeded')
    expanded = 0
    for merge in doc.findall('s:mergeCells/s:mergeCell', NS):
        start, end = merge.attrib['ref'].split(':')
        c1, r1 = _address(start)
        c2, r2 = _address(end)
        if r2 < r1 or _column(c2) < _column(c1):
            raise ValueError('Invalid merge range')
        expanded += (r2 - r1 + 1) * (_column(c2) - _column(c1) + 1)
        if expanded > 100000:
            raise ValueError('Merged cell expansion limit exceeded')
        # Vertical supplier merges only: do not invent blank rows or copy across fields.
        if c1 == c2:
            for rn in range(r1, r2 + 1):
                if rn in rows and rn != r1 and not rows[rn].get(c1):
                    rows[rn][c1] = rows.get(r1, {}).get(c1, '')
                    origins[(rn, c1)] = start
    return rows, origins


def read_sources(workbook_paths):
    result = {'schemaVersion': 1, 'sources': [], 'sheets': [], 'evidence': []}
    for path in sorted(map(Path, workbook_paths), key=lambda p: p.name):
        if path.stat().st_size > 64 * 1024 * 1024:
            raise ValueError('Workbook compressed size limit exceeded')
        raw = path.read_bytes()
        source_hash = hashlib.sha256(raw).hexdigest()
        result['sources'].append({'workbook': path.name, 'sourceHash': source_hash})
        with zipfile.ZipFile(path) as z:
            infos = z.infolist()
            if len(infos) > 4096 or len({i.filename for i in infos}) != len(infos):
                raise ValueError('Duplicate/excessive ZIP entries')
            if sum(i.file_size for i in infos) > 128 * 1024 * 1024 or any(i.file_size > 64 * 1024 * 1024 for i in infos):
                raise ValueError('Workbook expanded size limit exceeded')
            shared = []
            if 'xl/sharedStrings.xml' in z.namelist():
                shared = [''.join(t.text or '' for t in si.findall('.//s:t', NS)) for si in _xml(z, 'xl/sharedStrings.xml').findall('s:si', NS)]
            workbook = _xml(z, 'xl/workbook.xml')
            rels = {}
            for rel in _xml(z, 'xl/_rels/workbook.xml.rels'):
                target = rel.attrib.get('Target', '').replace('\\', '/')
                if rel.attrib.get('TargetMode') == 'External' or '..' in PurePosixPath(target).parts or ':' in target:
                    raise ValueError('Unsafe workbook relationship')
                key = rel.attrib['Id']
                if key in rels:
                    raise ValueError('Duplicate relationship ID')
                rels[key] = target.lstrip('/') if target.startswith('/xl/') else 'xl/' + target
            sheets = []
            for sheet in workbook.findall('s:sheets/s:sheet', NS):
                rows, origins = _rows(z, rels[sheet.attrib[REL]], shared)
                sheets.append((sheet.attrib['name'], rows, origins))
            aliases = {}
            for title, rows, _ in sheets:
                if norm(title) == 'summary':
                    for r in rows.values():
                        if r.get('C') and r.get('D') and norm(r['C']) != 'no.':
                            key = re.sub(r'\s+', '', norm(r['C']))
                            if key in aliases and aliases[key] != r['D']:
                                raise ValueError('Conflicting supplier alias')
                            aliases[key] = r['D']
            for title, rows, origins in sheets:
                before = len(result['evidence'])
                record = dict(workbook=path.name, sourceHash=source_hash, sheet=title,
                              disposition='UNSUPPORTED', columns=[], namedRows=0, reasonCodes=[])
                result['sheets'].append(record)

                def add(rn, column, kind, name, unit='', supplier='', origin=None):
                    result['evidence'].append(dict(sourceHash=source_hash, workbook=path.name,
                        sheet=title, row=rn, column=column, sourceKind=kind,
                        rawIngredient=name, rawUnit=unit, rawSupplierLabel=supplier,
                        mergeOrigin=origin, disposition='CANDIDATE',
                        reasonCodes=['TRANSACTION_NOT_CERTIFIED'] if kind == 'ORDER_CANDIDATE' else []))

                if norm(title) == 'summary':
                    record['disposition'] = 'SUPPLIER_ALIASES'
                    record['aliasCount'] = len(aliases)
                    continue
                if norm(title) == norm('NGUỒN'):
                    if not rows:
                        record['disposition'] = 'EMPTY'
                        continue
                    header_rn = min(rows)
                    headings = rows[header_rn]
                    record['disposition'] = 'MASTER_MEMBERSHIP'
                    record['columns'] = [{'column': col, 'label': label} for col, label in headings.items() if label]
                    for rn, cells in sorted(rows.items()):
                        if rn > header_rn:
                            for col, label in headings.items():
                                if label and cells.get(col):
                                    add(rn, col, 'MASTER_MEMBERSHIP', cells[col], supplier=label)
                else:
                    header = None
                    for rn, cells in sorted(rows.items()):
                        values = list(cells.values())
                        if 'Nguyên liệu chính' in values and 'Supplier' in values:
                            header = rn, cells, 'BOM_LABEL', 'Nguyên liệu chính'
                            break
                        if 'Tên hàng' in values and 'Đơn vị tính' in values and 'Ngày Giao hàng' in values:
                            header = rn, cells, 'ORDER_CANDIDATE', 'Tên hàng'
                            break
                    if header is None:
                        if any('Ngày Giao hàng' in cells.values() and 'Đơn vị tính' in cells.values() for cells in rows.values()):
                            record['disposition'] = 'UNSUPPORTED_ITEMLESS_LAYOUT'
                        elif not any(any(c.values()) for c in rows.values()):
                            record['disposition'] = 'EMPTY'
                        continue
                    hr, cells, kind, name_header = header
                    headers = defaultdict(list)
                    for col, value in cells.items():
                        if value:
                            headers[value].append(col)
                    required = [name_header, 'Supplier'] if kind == 'BOM_LABEL' else [name_header, 'Đơn vị tính', 'Ngày Giao hàng', 'Số lượng', 'Đơn giá']
                    if any(len(headers[h]) != 1 for h in required):
                        record['disposition'] = 'AMBIGUOUS_HEADERS'
                        continue
                    record['disposition'] = kind
                    nc = headers[name_header][0]
                    uc = headers['Đơn vị tính'][0] if kind == 'ORDER_CANDIDATE' else None
                    sc = headers['Supplier'][0] if kind == 'BOM_LABEL' else None
                    supplier = aliases.get(re.sub(r'\s+', '', norm(title)), re.sub(r'^\d+\.\s*', '', title.strip()))
                    for rn, data in sorted(rows.items()):
                        if rn <= hr:
                            continue
                        if data.get(nc) == name_header:
                            record['reasonCodes'].append('REPEATED_HEADER')
                            continue
                        if data.get(nc):
                            add(rn, nc, kind, data[nc], data.get(uc, '') if uc else '', data.get(sc, '') if sc else supplier, origins.get((rn, sc)))
                        if any(v == 'Tên hàng' and col != nc for col, v in data.items()):
                            record['reasonCodes'].append('SIDE_TABLE_NOT_EXTRACTED')
                record['namedRows'] = len(result['evidence']) - before
                record['reasonCodes'] = sorted(set(record['reasonCodes']))
    result['evidence'].sort(key=lambda e: (e['sourceHash'], e['sheet'], e['row'], e['column']))
    for e in result['evidence']:
        e['evidenceId'] = digest(e)
    result['fingerprint'] = digest(result)
    return result


def build_crosswalk(snapshot, sources):
    by_name, counts = defaultdict(list), Counter(norm(i['name']) for i in snapshot['ingredients'])
    for e in sources['evidence']:
        by_name[norm(e['rawIngredient'])].append(e)
    units = defaultdict(set)
    for u in snapshot.get('units', []):
        for value in [u['unitCode'], u.get('unitName', '')]:
            if value:
                units[norm(value)].add(u['unitCode'])
    supplier_index = defaultdict(list)
    for s in snapshot.get('suppliers', []):
        supplier_index[norm(s['name'])].append(s)
    rows = []
    for i in sorted(snapshot['ingredients'], key=lambda i: i['ingredientIdHex']):
        hits = by_name[norm(i['name'])]
        blockers = []
        notes = []
        if not i.get('unitIdHex') or not i.get('unitCode'):
            blockers.append('CANONICAL_UNIT_MISSING')
        if not hits:
            blockers.append('NO_DIRECT_EVIDENCE')
        if counts[norm(i['name'])] != 1:
            blockers.append('IDENTITY_AMBIGUOUS')
        order_suppliers = {norm(e['rawSupplierLabel']) for e in hits if e['sourceKind'] == 'ORDER_CANDIDATE' and e['rawSupplierLabel']}
        bom_suppliers = {norm(e['rawSupplierLabel']) for e in hits if e['sourceKind'] == 'BOM_LABEL' and e['rawSupplierLabel']}
        if len(order_suppliers) > 1:
            notes.append('MULTIPLE_SOURCE_SUPPLIERS')
        if bom_suppliers and order_suppliers and not bom_suppliers.issubset(order_suppliers):
            # A contextual BOM label and an order counterparty are different concepts.
            # Preserve the mismatch, but do not force a user to resolve 168 false identity conflicts.
            notes.append('SOURCE_LABEL_DISAGREEMENT')
        supplier_candidates = set()
        if 'suppliers' in snapshot:
            for label in order_suppliers:
                candidates = supplier_index[label]
                active = [s for s in candidates if s.get('isActive') is not False]
                supplier_candidates.update(s['supplierIdHex'] for s in candidates)
                if len(active) > 1:
                    blockers.append('SUPPLIER_IDENTITY_AMBIGUOUS')
                elif not candidates:
                    blockers.append('SUPPLIER_NOT_IN_CATALOG')
                elif not active:
                    blockers.append('SOURCE_SUPPLIER_INACTIVE')
        for e in hits:
            if e['rawUnit']:
                raw = e['rawUnit']
                compatible = norm(raw) == norm(i['unitCode']) or units[norm(raw)] == {i['unitCode']}
                # Conversions/package rules need the canonical owner; do not reproduce it here.
                if not compatible:
                    blockers.append('UNIT_REVIEW_REQUIRED')
        if i.get('isActive') is False:
            blockers.append('INACTIVE_INGREDIENT')
        rows.append({**i, 'evidence': hits, 'evidenceNotes': notes, 'supplierCandidateIds': sorted(supplier_candidates), 'blockerCodes': sorted(set(blockers)),
                     'recommendationState': 'MISSING_EVIDENCE', 'proposedGroupCode': None,
                     'reviewState': 'PENDING', 'ruleIds': [], 'decisionRefs': []})
    if len({r['ingredientIdHex'] for r in rows}) != len(rows):
        raise ValueError('Duplicate IngredientId in snapshot')
    return dict(schemaVersion=1, sourceHashes=sorted(s['sourceHash'] for s in sources.get('sources', [])),
                sourceFingerprint=sources.get('fingerprint'), rows=rows)


def evaluate_policy(crosswalk, policy):
    result = json.loads(json.dumps(crosswalk))
    rules = policy['rules']
    if len({r['ruleId'] for r in rules}) != len(rules):
        raise ValueError('Duplicate rule ID')
    for rule in rules:
        if (rule['groupCode'] is not None and rule['groupCode'] not in GROUPS) or rule.get('reviewState') not in ('PENDING', 'CONFIRMED'):
            raise ValueError('Invalid group/review state')
        if rule['groupCode'] is None and rule['reviewState'] != 'PENDING':
            raise ValueError('An unresolved disposition cannot be confirmed')
        if not rule.get('ingredientIdHex') and not (rule.get('sourceKind') and rule.get('supplierLabel')):
            raise ValueError('A rule needs an exact ID or source-kind/supplier selector')
        if rule.get('reviewState') == 'CONFIRMED' and not rule.get('decisionRef'):
            raise ValueError('Confirmed rule requires a decision reference')
    for row in result['rows']:
        matching = []
        for rule in rules:
            if row['ingredientIdHex'] in rule.get('excludedIngredientIds', []):
                continue
            if rule.get('ingredientIdHex'):
                matches = rule['ingredientIdHex'] == row['ingredientIdHex']
            else:
                matches = any(e['sourceKind'] == rule['sourceKind'] and norm(e['rawSupplierLabel']) == norm(rule['supplierLabel']) for e in row['evidence'])
            if matches:
                matching.append(rule)
        applicable = [r for r in matching if r['groupCode'] is not None]
        groups = {r['groupCode'] for r in applicable}
        row['ruleIds'] = sorted(r['ruleId'] for r in matching)
        row['decisionRefs'] = sorted({r['decisionRef'] for r in matching if r.get('decisionRef')})
        if len(groups) > 1:
            row['blockerCodes'].append('RULE_CONFLICT')
        elif len(groups) == 1:
            group = next(iter(groups))
            row['proposedGroupCode'] = group
            if group in ('FROZEN', 'FRESH_MEAT', 'FRESH_SEAFOOD') and not all(r.get('preservationEvidenceRef') for r in applicable):
                row['blockerCodes'].append('PRESERVATION_REVIEW_REQUIRED')
            if all(r['reviewState'] == 'CONFIRMED' for r in applicable) and not row['blockerCodes'] and row['evidence']:
                row['reviewState'] = 'CONFIRMED'
        if row['blockerCodes']:
            conflicts = {'RULE_CONFLICT', 'IDENTITY_AMBIGUOUS', 'SUPPLIER_IDENTITY_AMBIGUOUS'}
            row['recommendationState'] = 'CONFLICT' if conflicts.intersection(row['blockerCodes']) else 'MISSING_EVIDENCE'
        elif row['proposedGroupCode'] is not None:
            row['recommendationState'] = 'SUPPORTED'
        row['blockerCodes'] = sorted(set(row['blockerCodes']))
    result['policyHash'] = digest(policy)
    result['ruleVersion'] = policy['version']
    return result


def build_manifest(snapshot, evaluated, policy):
    decisions = []
    for row in evaluated['rows']:
        if row['reviewState'] == 'CONFIRMED' and not row['blockerCodes'] and row['proposedGroupCode'] is not None:
            decisions.append(dict(ingredientIdHex=row['ingredientIdHex'], unitIdHex=row['unitIdHex'],
                beforeGroup=row['currentGroup'], afterGroup=row['proposedGroupCode'],
                evidenceRefs=[e.get('evidenceId', digest(e)) for e in row['evidence']], decisionRef=' | '.join(row['decisionRefs'])))
    result = dict(schemaVersion=1, databaseIdentity=snapshot['databaseIdentity'],
        snapshotFingerprint=snapshot['fingerprint'], sourceHashes=evaluated['sourceHashes'],
        ruleVersion=policy['version'], policyHash=digest(policy), decisions=decisions,
        previewOnly=snapshot.get('schemaHasPreparationGroup') is not True or not decisions)
    result['mappingHash'] = digest(result)
    return result


def build_storage_review(snapshot, sources):
    """Research queue: report item wording, never infer a storage state from its vendor."""
    labels = {norm(label): supplier for supplier, aliases in [
        ('ĐL Ms. Thúy', ['ĐL Ms. Thúy', '8. ĐL - THUÝ']),
        ('ĐL Tuyến Tâm', ['ĐL Tuyến Tâm', '11. ĐL TUYẾN TÂM']),
        ('ĐL Sáng Ngọc', ['ĐL Sáng Ngọc', '16. NCC Sáng Ngọc'])] for label in aliases}
    index = defaultdict(list)
    for i in snapshot['ingredients']:
        index[norm(i['name'])].append(i['ingredientIdHex'])
    by_item = defaultdict(list)
    for e in sources['evidence']:
        if norm(e['rawSupplierLabel']) in labels:
            by_item[(norm(e['rawIngredient']), labels[norm(e['rawSupplierLabel'])])].append(e)
    rows = []
    for (name, supplier), hits in sorted(by_item.items()):
        frozen = 'đông lạnh' in name
        fresh = re.search(r'\btươi\b', name) is not None
        abbreviation = re.search(r'\bđl\b', name) is not None
        state = 'CONFLICTING_LABELS' if fresh and (frozen or abbreviation) else 'SOURCE_FROZEN_LABEL' if frozen else 'SOURCE_FRESH_LABEL' if fresh else 'ITEM_DL_ABBREVIATION' if abbreviation else 'UNKNOWN'
        rows.append(dict(rawIngredient=hits[0]['rawIngredient'], sourceSupplierLabel=supplier,
            originalSupplierLabels=sorted({e['rawSupplierLabel'] for e in hits}),
            ingredientCandidateIds=sorted(index[name]), storageEvidence=state, reviewState='PENDING',
            evidenceRefs=[e.get('evidenceId', digest(e)) for e in hits],
            trace=[dict(sheet=e['sheet'], row=e['row'], sourceHash=e['sourceHash']) for e in hits]))
    return rows


def _csv(path, rows, fields):
    with path.open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        for row in rows:
            safe = {}
            for key in fields:
                value = row.get(key, '')
                if isinstance(value, (list, dict)):
                    value = json.dumps(value, ensure_ascii=False)
                if isinstance(value, str) and value.lstrip().startswith(('=', '+', '-', '@')):
                    value = "'" + value
                safe[key] = value
            writer.writerow(safe)


def write_reports(result, output_dir):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / 'source-inventory.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    _csv(output_dir / 'source-lineage.csv', result['evidence'], ['evidenceId', 'sourceHash', 'workbook', 'sourceKind', 'sheet', 'row', 'column', 'rawIngredient', 'rawUnit', 'rawSupplierLabel', 'mergeOrigin', 'disposition', 'reasonCodes'])
    _csv(output_dir / 'sheet-review.csv', result['sheets'], ['workbook', 'sheet', 'disposition', 'namedRows', 'columns', 'reasonCodes'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    inventory = commands.add_parser('inventory')
    inventory.add_argument('--source-dir', type=Path, required=True)
    inventory.add_argument('--output', type=Path, required=True)
    walk = commands.add_parser('crosswalk')
    for name in ['snapshot', 'sources', 'policy', 'output']:
        walk.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    if args.command == 'inventory':
        paths = [args.source_dir / name for name in SOURCES]
        for p in paths:
            if hashlib.sha256(p.read_bytes()).hexdigest() != SOURCES[p.name]:
                raise ValueError('Source hash changed; establish a new reviewed baseline')
        result = read_sources(paths)
        write_reports(result, args.output)
        print(json.dumps(dict(sources=len(result['sources']), sheets=len(result['sheets']), namedEvidence=len(result['evidence']), fingerprint=result['fingerprint'])))
    else:
        load = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
        snapshot, sources, policy = load(args.snapshot), load(args.sources), load(args.policy)
        result = evaluate_policy(build_crosswalk(snapshot, sources), policy)
        args.output.mkdir(parents=True, exist_ok=True)
        for filename, data in [('crosswalk.json', result), ('manifest-preview.json', build_manifest(snapshot, result, policy))]:
            (args.output / filename).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        fields = ['ingredientIdHex', 'ingredientCode', 'name', 'unitCode', 'isActive', 'currentGroup', 'recommendationState', 'proposedGroupCode', 'reviewState', 'blockerCodes', 'evidenceNotes', 'ruleIds']
        _csv(args.output / 'ingredient-crosswalk.csv', result['rows'], fields)
        _csv(args.output / 'exception-review.csv', [r for r in result['rows'] if r['blockerCodes']], fields)
        policy_rows = []
        for rule in policy['rules']:
            affected = [r for r in result['rows'] if rule['ruleId'] in r['ruleIds']]
            policy_rows.append({**rule, 'affectedIngredients': len(affected),
                'withBlockers': sum(bool(r['blockerCodes']) for r in affected),
                'examples': [r['ingredientCode'] + ': ' + r['name'] for r in affected[:4]]})
        _csv(args.output / 'policy-review.csv', policy_rows, ['ruleId', 'sourceKind', 'supplierLabel', 'groupCode', 'reviewState', 'affectedIngredients', 'withBlockers', 'examples'])
        exceptions = []
        for blocker in sorted({b for r in result['rows'] for b in r['blockerCodes']}):
            affected = [r for r in result['rows'] if blocker in r['blockerCodes']]
            exceptions.append(dict(blocker=blocker, affectedIngredients=len(affected), examples=[r['ingredientCode'] + ': ' + r['name'] for r in affected[:5]]))
        _csv(args.output / 'exception-summary.csv', exceptions, ['blocker', 'affectedIngredients', 'examples'])
        summary = dict(total=len(result['rows']), matched=sum(bool(r['evidence']) for r in result['rows']), confirmed=sum(r['reviewState'] == 'CONFIRMED' for r in result['rows']), states=dict(Counter(r['recommendationState'] for r in result['rows'])), blockers=dict(Counter(b for r in result['rows'] for b in r['blockerCodes'])))
        storage = build_storage_review(snapshot, sources)
        _csv(args.output / 'storage-research.csv', storage, ['rawIngredient', 'sourceSupplierLabel', 'originalSupplierLabels', 'ingredientCandidateIds', 'storageEvidence', 'reviewState', 'evidenceRefs', 'trace'])
        summary['storageResearch'] = dict(Counter(r['storageEvidence'] for r in storage))
        summary['evidenceNotes'] = dict(Counter(n for r in result['rows'] for n in r['evidenceNotes']))
        (args.output / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(summary))


if __name__ == '__main__':
    main()
