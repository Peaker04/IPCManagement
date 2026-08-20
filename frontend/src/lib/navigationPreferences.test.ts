import { describe, expect, it } from 'vitest';
import { defaultNavigationPreferences, pageTabGroups, readNavigationPreferences, readPageTabPreferences, visibleTabIds, writeNavigationPreferences, writePageTabPreferences } from './navigationPreferences';

const storage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } as unknown as Storage;
};

describe('navigation display preferences', () => {
  it('defaults to every operational area visible', () => {
    expect(readNavigationPreferences(storage())).toEqual(defaultNavigationPreferences);
  });

  it('round-trips only known boolean settings', () => {
    const target = storage();
    writeNavigationPreferences({ ...defaultNavigationPreferences, reports: false }, target);
    expect(readNavigationPreferences(target).reports).toBe(false);
    target.setItem('ipc.navigation-preferences.v1', '{"reports":"false","unknown":false}');
    expect(readNavigationPreferences(target).reports).toBe(true);
  });

  it('covers every shared ViewSwitcher group without allowing an empty group', () => {
    const target = storage();
    const preferences = readPageTabPreferences(target);
    expect(pageTabGroups).toHaveLength(7);
    for (const group of pageTabGroups) expect(visibleTabIds(group.id, preferences).length).toBe(group.tabs.length);

    preferences.reports.audit = false;
    writePageTabPreferences(preferences, target);
    expect(visibleTabIds('reports', readPageTabPreferences(target))).not.toContain('audit');
  });
});
