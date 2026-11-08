-- Phase 04.2 reviewed business release preflight.
-- Exact inputs: {{TARGET_DATABASE}}, {{RUNTIME_MANIFEST_SHA256}}, {{EXPECTED_MIGRATION_HEAD}}.
SET @phase42_target = '{{TARGET_DATABASE}}';
SET @phase42_manifest_sha256 = '{{RUNTIME_MANIFEST_SHA256}}';
SET @phase42_expected_migration_head = '{{EXPECTED_MIGRATION_HEAD}}';

SELECT
    @phase42_target REGEXP '^ipc_rehearsal_phase42_[a-z0-9_]+$' AS target_name_valid,
    (SELECT COUNT(*)
       FROM information_schema.schemata
      WHERE schema_name = @phase42_target) AS target_exists,
    (SELECT MAX(MigrationId)
       FROM `{{TARGET_DATABASE}}`.`__EFMigrationsHistory`) AS migration_head,
    CHAR_LENGTH(@phase42_manifest_sha256) = 64 AS manifest_hash_valid;

{{PREFLIGHT_ASSERTIONS}}
