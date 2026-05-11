import type { StateCreator } from 'zustand';

export type PaletteMode = 'commands' | 'files';

export type CommandPaletteSlice = {
  paletteOpen: boolean;
  paletteMode: PaletteMode;
  openPalette: (mode?: PaletteMode) => void;
  closePalette: () => void;
};

export const createCommandPaletteSlice: StateCreator<CommandPaletteSlice, [], [], CommandPaletteSlice> = (set) => ({
  paletteOpen: false,
  paletteMode: 'commands',

  openPalette(mode = 'commands') {
    set({ paletteOpen: true, paletteMode: mode });
  },

  closePalette() {
    set({ paletteOpen: false });
  },
});
