-- Phase 04.2 reviewed postflight. It must run after every apply with the same manifest hash.
-- Exact inputs: {{TARGET_DATABASE}}, {{RUNTIME_MANIFEST_SHA256}}, {{EXPECTED_MIGRATION_HEAD}}.
SET @phase42_target = '{{TARGET_DATABASE}}';
SET @phase42_manifest_sha256 = '{{RUNTIME_MANIFEST_SHA256}}';

SELECT
    @phase42_target REGEXP '^ipc_rehearsal_phase42_[a-z0-9_]+$' AS target_name_valid,
    (SELECT MAX(MigrationId)
       FROM `{{TARGET_DATABASE}}`.`__EFMigrationsHistory`) = '{{EXPECTED_MIGRATION_HEAD}}' AS migration_head_matches,
    CHAR_LENGTH(@phase42_manifest_sha256) = 64 AS manifest_hash_valid;

{{POSTFLIGHT_ASSERTIONS}}
