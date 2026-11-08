export type ComponentInteractionState =
  | 'disabled'
  | 'loading'
  | 'readonly'
  | 'error'
  | 'warning'
  | 'active'
  | 'idle';

export function resolveInteractionState(params: {
  disabled?: boolean;
  loading?: boolean;
  readOnly?: boolean;
  error?: boolean;
  warning?: boolean;
  active?: boolean;
}): ComponentInteractionState {
  if (params.disabled) return 'disabled';
  if (params.loading) return 'loading';
  if (params.readOnly) return 'readonly';
  if (params.error) return 'error';
  if (params.warning) return 'warning';
  if (params.active) return 'active';
  return 'idle';
}
