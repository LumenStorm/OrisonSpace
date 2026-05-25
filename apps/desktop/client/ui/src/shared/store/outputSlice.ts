import type { StateCreator } from 'zustand';

export type OutputEntryLevel = 'info' | 'success' | 'error';
export type OutputEntryScope = 'model' | 'image' | 'system';

export type OutputEntry = {
  id: string;
  timestamp: string;
  level: OutputEntryLevel;
  scope: OutputEntryScope;
  message: string;
  detail?: string;
};

export type OutputSlice = {
  outputEntries: OutputEntry[];
  appendOutputEntry: (entry: Omit<OutputEntry, 'id' | 'timestamp'> & { timestamp?: string }) => void;
  clearOutputEntries: () => void;
};

export const createOutputSlice: StateCreator<OutputSlice, [], [], OutputSlice> = (set) => ({
  outputEntries: [],
  appendOutputEntry(entry) {
    const timestamp = entry.timestamp ?? new Date().toISOString();
    const nextEntry: OutputEntry = {
      ...entry,
      timestamp,
      id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    };

    set((state) => ({
      outputEntries: [nextEntry, ...state.outputEntries].slice(0, 120),
    }));
  },
  clearOutputEntries() {
    set({ outputEntries: [] });
  },
});
