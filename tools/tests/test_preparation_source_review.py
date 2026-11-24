"""Small synthetic ZIP specimens test parsing; they are not business evidence."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import unicodedata
import zipfile
from xml.sax.saxutils import escape

MODULE = Path(__file__).resolve().parents[1] / 'preparation_source_review.py'
spec = importlib.util.spec_from_file_location('review', MODULE)
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


def workbook(path, sheets):
    ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr('xl/workbook.xml', f'<workbook xmlns="{ns}" xmlns:r="{rel}"><sheets>' + ''.join(
            f'<sheet name="{escape(name)}" sheetId="{i}" r:id="r{i}"/>' for i, (name, _, _) in enumerate(sheets, 1)) + '</sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ''.join(
            f'<Relationship Id="r{i}" Target="worksheets/sheet{i}.xml" Type="{rel}/worksheet"/>' for i in range(1, len(sheets) + 1)) + '</Relationships>')
        for i, (_, rows, merges) in enumerate(sheets, 1):
            data = ''.join(f'<row r="{rn}">' + ''.join(
                f'<c r="{col}{rn}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>' for col, value in cells.items()) + '</row>' for rn, cells in rows)
            z.writestr(f'xl/worksheets/sheet{i}.xml', f'<worksheet xmlns="{ns}"><sheetData>{data}</sheetData>' + ('<mergeCells>' + ''.join(f'<mergeCell ref="{m}"/>' for m in merges) + '</mergeCells>' if merges else '') + '</worksheet>')


class EvidenceReaderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'raw.xlsx'

    def test_sources_preserve_physical_rows_alias_and_explicit_merges(self):
        workbook(self.path, [
            ('SUMMARY', [(4, {'C': ' 1.Rau ', 'D': 'NCC Rau'})], []),
            ('NGUỒN', [(1, {'A': 'Rau', 'B': 'Thịt tươi'}), (3, {'A': 'Sả', 'B': 'Sả'})], []),
            ('1.rau', [(3, {'B': 'Ngày Giao hàng', 'C': 'Tên hàng', 'D': 'Đơn vị tính', 'E': 'Số lượng', 'F': 'Đơn giá'}), (9, {'B': '2026-07-20', 'C': 'Sả', 'D': 'Kg'})], []),
            ('định lượng suất 25k', [(2, {'A': 'Supplier', 'F': 'Nguyên liệu chính'}), (8, {'A': 'NL Rau', 'F': 'Sả'}), (9, {'F': 'Gạo'}), (10, {'F': 'Muối'})], ['A8:A9']),
            ('29.CHUỐI', [(4, {'B': 'Ngày Giao hàng', 'C': 'Đơn vị tính', 'D': 'Số lượng', 'E': 'Đơn giá'}), (5, {'C': 'Kg'})], []),
            ('other', [(1, {'A': 'Unrecognized'})], []),
        ])
        result = review.read_sources([self.path])
        order = [e for e in result['evidence'] if e['sourceKind'] == 'ORDER_CANDIDATE'][0]
        self.assertEqual(('NCC Rau', 9, 'C'), (order['rawSupplierLabel'], order['row'], order['column']))
        self.assertNotIn('price', json.dumps(order).lower())
        bom = [e for e in result['evidence'] if e['sourceKind'] == 'BOM_LABEL']
        self.assertEqual(['NL Rau', 'NL Rau', ''], [e['rawSupplierLabel'] for e in bom])
        self.assertEqual('A8', bom[1]['mergeOrigin'])
        kinds = {s['sheet']: s['disposition'] for s in result['sheets']}
        self.assertEqual('UNSUPPORTED_ITEMLESS_LAYOUT', kinds['29.CHUỐI'])
        self.assertEqual('UNSUPPORTED', kinds['other'])
        self.assertEqual(2, len([e for e in result['evidence'] if e['sourceKind'] == 'MASTER_MEMBERSHIP']))

    def test_repeated_and_duplicate_headers_are_not_silently_accepted(self):
        workbook(self.path, [('s', [(1, {'A': 'Tên hàng', 'B': 'Tên hàng', 'C': 'Đơn vị tính', 'D': 'Ngày Giao hàng', 'E': 'Số lượng', 'F': 'Đơn giá'})], [])])
        self.assertEqual('AMBIGUOUS_HEADERS', review.read_sources([self.path])['sheets'][0]['disposition'])

    def test_read_does_not_change_original_and_hash_is_deterministic(self):
        workbook(self.path, [('empty', [], [])])
        before = self.path.read_bytes()
        self.assertEqual(review.read_sources([self.path]), review.read_sources([self.path]))
        self.assertEqual(before, self.path.read_bytes())

    def test_external_or_traversing_relationship_is_rejected(self):
        workbook(self.path, [('s', [], [])])
        with zipfile.ZipFile(self.path) as z:
            parts = {name: z.read(name) for name in z.namelist()}
        parts['xl/_rels/workbook.xml.rels'] = '<Relationships><Relationship Id="r1" Target="../../escape.xml"/></Relationships>'
        with zipfile.ZipFile(self.path, 'w') as z:
            for name, data in parts.items():
                z.writestr(name, data)
        with self.assertRaises(ValueError):
            review.read_sources([self.path])

    def test_dtd_is_rejected(self):
        with zipfile.ZipFile(self.path, 'w') as z:
            z.writestr('xl/workbook.xml', '<!DOCTYPE x [<!ENTITY bad "x">]><x/>')
        with self.assertRaises(ValueError):
            review.read_sources([self.path])

    def test_encoded_dtd_is_rejected(self):
        with zipfile.ZipFile(self.path, 'w') as z:
            z.writestr('xl/workbook.xml', '<!DOCTYPE x [<!ENTITY bad "x">]><x/>'.encode('utf-16'))
        with self.assertRaisesRegex(ValueError, 'DTD'):
            review.read_sources([self.path])


def ingredient(code='I1', name='Sả', unit='KG', **extra):
    return dict(ingredientIdHex=code, ingredientCode=code, name=name, unitIdHex=unit,
                unitCode=unit, isActive=True, currentGroup=None, **extra)


def evidence(name='Sả', unit='Kg', supplier='Rau', kind='ORDER_CANDIDATE'):
    return dict(sourceHash='a' * 64, workbook='raw.xlsx', sheet='1.Rau', row=9,
                column='C', sourceKind=kind, rawIngredient=name, rawUnit=unit,
                rawSupplierLabel=supplier, mergeOrigin=None, disposition='CANDIDATE',
                reasonCodes=[])


class CrosswalkTests(unittest.TestCase):
    def test_multiple_sources_are_not_automatically_an_identity_conflict(self):
        row = review.build_crosswalk({'ingredients': [ingredient()]}, {'evidence': [evidence(supplier='Rau'), evidence(supplier='NCC khác')]})['rows'][0]
        self.assertIn('MULTIPLE_SOURCE_SUPPLIERS', row['evidenceNotes'])
        self.assertNotIn('MULTIPLE_SOURCE_SUPPLIERS', row['blockerCodes'])
    def test_missing_canonical_unit_never_becomes_an_accepted_assignment(self):
        snap = {'ingredients': [ingredient(unit=None)]}
        row = review.build_crosswalk(snap, {'evidence': [evidence()]})['rows'][0]
        self.assertIn('CANONICAL_UNIT_MISSING', row['blockerCodes'])

    def test_supplier_display_name_cannot_resolve_two_active_ids(self):
        snap = {'ingredients': [ingredient()], 'suppliers': [
            {'supplierIdHex': 'S1', 'name': 'Rau', 'isActive': True},
            {'supplierIdHex': 'S2', 'name': 'RAU', 'isActive': True}]}
        row = review.build_crosswalk(snap, {'evidence': [evidence()]})['rows'][0]
        self.assertIn('SUPPLIER_IDENTITY_AMBIGUOUS', row['blockerCodes'])
        self.assertEqual(['S1', 'S2'], row['supplierCandidateIds'])

    def test_case_nfc_and_spaces_match_but_accents_and_sizes_do_not_merge(self):
        snap = {'ingredients': [ingredient(name='Sả'), ingredient('I2', 'Tôm 170c'), ingredient('I3', 'Sa')]}
        src = {'evidence': [evidence(unicodedata.normalize('NFD', '  SẢ ')), evidence('Tôm 120c')]}
        result = review.build_crosswalk(snap, src)
        by = {r['ingredientIdHex']: r for r in result['rows']}
        self.assertEqual(1, len(by['I1']['evidence']))
        self.assertEqual([], by['I2']['evidence'])
        self.assertEqual([], by['I3']['evidence'])

    def test_duplicate_name_identity_and_units_are_visible_not_resolved(self):
        snap = {'ingredients': [ingredient(), ingredient('I2', unit='GOI')]}
        result = review.build_crosswalk(snap, {'evidence': [evidence()]})
        self.assertEqual(2, len(result['rows']))
        self.assertTrue(all('IDENTITY_AMBIGUOUS' in r['blockerCodes'] for r in result['rows']))
        self.assertIn('UNIT_REVIEW_REQUIRED', result['rows'][1]['blockerCodes'])

    def test_bom_conflict_units_and_supplier_variants_are_separate_blockers(self):
        snap = {'ingredients': [ingredient(name='Ngũ vị hương', unit='HOP')]}
        src = {'evidence': [evidence('Ngũ vị hương', 'Hộp', 'Gia vị'), evidence('Ngũ vị hương', 'gói', 'Gia vị'), evidence('Ngũ vị hương', '', 'NL Rau', 'BOM_LABEL')]}
        row = review.build_crosswalk(snap, src)['rows'][0]
        self.assertIn('UNIT_REVIEW_REQUIRED', row['blockerCodes'])
        self.assertIn('SOURCE_LABEL_DISAGREEMENT', row['evidenceNotes'])
        self.assertEqual(3, len(row['evidence']))

    def test_bom_context_label_is_not_compared_as_a_real_supplier_identity(self):
        snap = {'ingredients': [ingredient(name='Gạo')]}
        row = review.build_crosswalk(snap, {'evidence': [evidence('Gạo', supplier='Gạo'), evidence('Gạo', unit='', supplier='NL Rau', kind='BOM_LABEL')]})['rows'][0]
        self.assertIn('SOURCE_LABEL_DISAGREEMENT', row['evidenceNotes'])
        self.assertNotIn('SOURCE_LABEL_DISAGREEMENT', row['blockerCodes'])


class PolicyTests(unittest.TestCase):
    def crosswalk(self):
        return review.build_crosswalk({'ingredients': [ingredient()]}, {'evidence': [evidence()]})

    def test_draft_rule_is_never_a_confirmed_assignment(self):
        p = {'version': 'v1', 'rules': [dict(ruleId='rau', sourceKind='ORDER_CANDIDATE', supplierLabel='Rau', groupCode='PRODUCE', reviewState='PENDING', decisionRef='')]}
        row = review.evaluate_policy(self.crosswalk(), p)['rows'][0]
        self.assertEqual('PENDING', row['reviewState'])
        self.assertEqual('PRODUCE', row['proposedGroupCode'])
        self.assertEqual('SUPPORTED', row['recommendationState'])

    def test_contradicting_rules_and_unconfirmed_freshness_block(self):
        p = {'version': 'v1', 'rules': [dict(ruleId='a', ingredientIdHex='I1', groupCode='FRESH_MEAT', reviewState='CONFIRMED', decisionRef='D'), dict(ruleId='b', ingredientIdHex='I1', groupCode='PRODUCE', reviewState='CONFIRMED', decisionRef='D')]}
        row = review.evaluate_policy(self.crosswalk(), p)['rows'][0]
        self.assertEqual('CONFLICT', row['recommendationState'])
        self.assertIn('RULE_CONFLICT', row['blockerCodes'])

    def test_frozen_requires_evidence_and_generic_supplier_never_implies_group(self):
        p = {'version': 'v1', 'rules': [dict(ruleId='a', ingredientIdHex='I1', groupCode='FROZEN', reviewState='CONFIRMED', decisionRef='D')]}
        row = review.evaluate_policy(self.crosswalk(), p)['rows'][0]
        self.assertIn('PRESERVATION_REVIEW_REQUIRED', row['blockerCodes'])
        self.assertEqual('MISSING_EVIDENCE', row['recommendationState'])
        empty = review.evaluate_policy(self.crosswalk(), {'version': 'v1', 'rules': []})['rows'][0]
        self.assertIsNone(empty['proposedGroupCode'])

    def test_manifest_excludes_pending_and_is_deterministic(self):
        snap = {'databaseIdentity': 'ipcmanagement', 'fingerprint': 'F', 'ingredients': [ingredient()]}
        p = {'version': 'v1', 'rules': []}
        result = review.evaluate_policy(self.crosswalk(), p)
        manifest = review.build_manifest(snap, result, p)
        self.assertEqual([], manifest['decisions'])
        self.assertEqual(manifest, review.build_manifest(snap, result, p))

    def test_unresolved_source_disposition_does_not_create_false_group_conflict(self):
        p = {'version': 'v1', 'rules': [dict(ruleId='known', ingredientIdHex='I1', groupCode='PRODUCE', reviewState='PENDING', decisionRef=''), dict(ruleId='unknown', ingredientIdHex='I1', groupCode=None, reviewState='PENDING', decisionRef='')]}
        row = review.evaluate_policy(self.crosswalk(), p)['rows'][0]
        self.assertEqual('PRODUCE', row['proposedGroupCode'])
        self.assertNotIn('RULE_CONFLICT', row['blockerCodes'])

    def test_rule_cannot_confirm_an_item_without_direct_evidence(self):
        walk = review.build_crosswalk({'ingredients': [ingredient()]}, {'evidence': []})
        p = {'version': 'v1', 'rules': [dict(ruleId='a', ingredientIdHex='I1', groupCode='PRODUCE', reviewState='CONFIRMED', decisionRef='D')]}
        row = review.evaluate_policy(walk, p)['rows'][0]
        self.assertEqual('PENDING', row['reviewState'])
        self.assertNotEqual('SUPPORTED', row['recommendationState'])


class StorageResearchTests(unittest.TestCase):
    def test_supplier_abbreviation_does_not_override_fresh_item_or_generic_name(self):
        rows = [evidence('Vịt tươi', supplier='ĐL Tuyến Tâm'), evidence('Gà', supplier='ĐL Tuyến Tâm'), evidence('Sườn bẹ ĐL', supplier='ĐL Tuyến Tâm'), evidence('Cá đông lạnh', supplier='ĐL Sáng Ngọc')]
        result = review.build_storage_review({'ingredients': []}, {'evidence': rows})
        states = {r['rawIngredient']: r['storageEvidence'] for r in result}
        self.assertEqual('SOURCE_FRESH_LABEL', states['Vịt tươi'])
        self.assertEqual('UNKNOWN', states['Gà'])
        self.assertEqual('ITEM_DL_ABBREVIATION', states['Sườn bẹ ĐL'])
        self.assertEqual('SOURCE_FROZEN_LABEL', states['Cá đông lạnh'])
        self.assertTrue(all(r['reviewState'] == 'PENDING' for r in result))


if __name__ == '__main__':
    unittest.main()
