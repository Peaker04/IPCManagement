import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

export interface StoredDraft<T> {
  data: T;
  savedAt: string;
}

export interface UseClientDraftPersistenceOptions<T> {
  formKey: string;
  userId?: string | null;
  currentData: T;
  isDirty: boolean;
  debounceMs?: number;
}

const DRAFT_PREFIX = 'ipc_draft_';

export function getDraftStorageKey(formKey: string, userId?: string | null): string {
  const safeUser = userId || 'default';
  return `${DRAFT_PREFIX}${safeUser}_${formKey}`;
}

export function clearAllClientDrafts(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (err) {
    console.error('Failed to purge client drafts:', err);
  }
}

/**
 * Enterprise Client-Side Auto-Draft Persistence Hook (Rules L3-DATA-02, L1-DATA-03)
 * - Automatically snapshots dirty form state with timestamp.
 * - Detects restorable drafts after crash/F5/power loss.
 * - Provides restoreDraft, discardDraft, and clearDraft functions.
 */
export function useClientDraftPersistence<T>({
  formKey,
  userId,
  currentData,
  isDirty,
  debounceMs = 500,
}: UseClientDraftPersistenceOptions<T>) {
  const storageKey = useMemo(() => getDraftStorageKey(formKey, userId), [formKey, userId]);

  const [storedDraft, setStoredDraft] = useState<StoredDraft<T> | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return null;
  });

  const [hasRestorableDraft, setHasRestorableDraft] = useState<boolean>(() => !!storedDraft);

  // Debounced auto-save when isDirty
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDirty) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      try {
        const payload: StoredDraft<T> = {
          data: currentData,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
        setStoredDraft(payload);
      } catch (err) {
        console.error('Failed to auto-save draft:', err);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentData, isDirty, storageKey, debounceMs]);

  const restoreDraft = useCallback((): T | null => {
    if (!storedDraft) return null;
    setHasRestorableDraft(false);
    return storedDraft.data;
  }, [storedDraft]);

  const discardDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setStoredDraft(null);
      setHasRestorableDraft(false);
    } catch (err) {
      console.error('Failed to discard draft:', err);
    }
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setStoredDraft(null);
      setHasRestorableDraft(false);
    } catch (err) {
      console.error('Failed to clear draft on submit:', err);
    }
  }, [storageKey]);

  return {
    hasRestorableDraft,
    draftSavedAt: storedDraft?.savedAt ?? null,
    restoreDraft,
    discardDraft,
    clearDraft,
  };
}
