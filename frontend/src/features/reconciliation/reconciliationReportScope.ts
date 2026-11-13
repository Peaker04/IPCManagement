export function reconciliationReportScope(
  actorModePrefix: string,
  tab: string,
  batchId: string,
  auditSubTab = 'warehouse',
  search = '',
  completedFilterKey = '{}',
) {
  const tabScope = `${actorModePrefix}${tab}${tab === 'audit' ? `_${auditSubTab}` : ''}`;
  const filter = tab === 'completed' ? (completedFilterKey === '{}' ? 'all' : completedFilterKey)
    : tab === 'audit' ? `${batchId}_${auditSubTab}_${search}` : batchId;
  return { tabScope, reportScope: `${tabScope}_${filter}` };
}
