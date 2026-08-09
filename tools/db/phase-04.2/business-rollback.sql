-- Phase 04.2 reviewed append-only compensation wrapper.
-- Exact inputs: {{TARGET_DATABASE}}, {{RUNTIME_MANIFEST_SHA256}}, {{COMMAND_ID}}.
-- Destructive seven-table rollback is extract restoration owned by BackupTableRetirementCommand.
SET @phase42_target = '{{TARGET_DATABASE}}';
SET @phase42_manifest_sha256 = '{{RUNTIME_MANIFEST_SHA256}}';
SET @phase42_command_id = '{{COMMAND_ID}}';

SELECT
    @phase42_target REGEXP '^ipc_rehearsal_phase42_[a-z0-9_]+$' AS target_name_valid,
    CHAR_LENGTH(@phase42_manifest_sha256) = 64 AS manifest_hash_valid,
    CHAR_LENGTH(@phase42_command_id) > 0 AS command_id_present;

START TRANSACTION;
{{APPEND_ONLY_COMPENSATION_COMMANDS}}
COMMIT;
