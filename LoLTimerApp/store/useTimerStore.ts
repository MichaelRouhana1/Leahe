import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The four discrete level breakpoints the toggle cycles through. */
export type ChampionLevel = 1 | 6 | 11 | 16;

const LEVEL_CYCLE: ChampionLevel[] = [1, 6, 11, 16];

/**
 * Maps a `ChampionLevel` to the index inside `ultBaseCooldowns`.
 * Level 1 has no ultimate, so we return `null`.
 */
function ultCooldownIndex(level: ChampionLevel): number | null {
  switch (level) {
    case 1:
      return null; // no ult at level 1
    case 6:
      return 0;
    case 11:
      return 1;
    case 16:
      return 2;
  }
}

/** A single enemy champion slot. */
export interface EnemyChampion {
  /** Data Dragon champion id, e.g. "Aatrox". Empty string = unset slot. */
  id: string;
  /** Display name, e.g. "Aatrox". */
  name: string;

  /**
   * Base ultimate cooldowns at the three rank‑up levels (6 / 11 / 16).
   * Example for Lux: [80, 60, 40].
   */
  ultBaseCooldowns: [number, number, number];

  /**
   * The currently "active" base cooldown for the ultimate.
   * Derived from `currentLevel` + `ultBaseCooldowns`.
   * `null` when `currentLevel` is 1 (champion has no ult yet).
   */
  activeUltCooldown: number | null;

  /** Current level breakpoint (cycles: 1 → 6 → 11 → 16 → 1). */
  currentLevel: ChampionLevel;

  /** Ability Haste stat entered by the user (default 0). */
  abilityHaste: number;

  // ---- Timer end‑times (epoch ms) – null means timer is inactive ----------
  /** When the ultimate timer expires (epoch ms). */
  ultEndTime: number | null;
  /** When summoner spell 1 timer expires (epoch ms). */
  spell1EndTime: number | null;
  /** When summoner spell 2 timer expires (epoch ms). */
  spell2EndTime: number | null;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface TimerStoreState {
  /** Five enemy champion slots (indices 0–4). */
  enemies: EnemyChampion[];

  // ---- Pure utility -------------------------------------------------------
  /**
   * Standard League cooldown‑reduction formula.
   *
   *   Effective CD = Base / (1 + Haste / 100)
   *
   * Returns the reduced cooldown in **seconds**.
   */
  calculateCooldown: (base: number, haste: number) => number;

  // ---- Champion setup -----------------------------------------------------
  /** Replace a champion slot with new data (partial merge). */
  setChampion: (index: number, data: Partial<EnemyChampion>) => void;

  /** Reset a slot back to its empty default state. */
  clearChampion: (index: number) => void;

  // ---- Level toggle -------------------------------------------------------
  /**
   * Cycle the champion at `index` through 1 → 6 → 11 → 16 → 1.
   * Automatically updates `activeUltCooldown` to match the new level.
   */
  cycleLevel: (index: number) => void;

  // ---- Ability Haste ------------------------------------------------------
  /** Update the ability haste value for a champion. */
  setAbilityHaste: (index: number, haste: number) => void;

  // ---- Timers -------------------------------------------------------------
  /** Start the ultimate timer for the champion at `index`. */
  startUltTimer: (index: number) => void;

  /**
   * Start a summoner spell timer.
   * @param spellSlot  1 or 2
   * @param baseCooldown  Base cooldown of the summoner spell **in seconds**
   */
  startSpellTimer: (
    index: number,
    spellSlot: 1 | 2,
    baseCooldown: number
  ) => void;

  /** Clear (cancel) the ultimate timer. */
  clearUltTimer: (index: number) => void;

  /** Clear (cancel) a summoner spell timer. */
  clearSpellTimer: (index: number, spellSlot: 1 | 2) => void;

  /** Reset all 5 enemy slots for a new match. */
  resetAll: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEmptyChampion(): EnemyChampion {
  return {
    id: "",
    name: "",
    ultBaseCooldowns: [0, 0, 0],
    activeUltCooldown: null,
    currentLevel: 1,
    abilityHaste: 0,
    ultEndTime: null,
    spell1EndTime: null,
    spell2EndTime: null,
  };
}

function deriveActiveUltCooldown(
  level: ChampionLevel,
  ultBaseCooldowns: [number, number, number]
): number | null {
  const idx = ultCooldownIndex(level);
  return idx !== null ? ultBaseCooldowns[idx] : null;
}

/** Clamp `index` to [0, 4] and return it, or `null` if out of range. */
function validIndex(index: number): number | null {
  if (index < 0 || index > 4) return null;
  return index;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTimerStore = create<TimerStoreState>()((set, get) => ({
  // ---- State --------------------------------------------------------------
  enemies: Array.from({ length: 5 }, createEmptyChampion),

  // ---- Pure utility -------------------------------------------------------
  calculateCooldown(base: number, haste: number): number {
    return base / (1 + haste / 100);
  },

  // ---- Champion setup -----------------------------------------------------
  setChampion(index: number, data: Partial<EnemyChampion>) {
    const i = validIndex(index);
    if (i === null) return;

    set((state) => {
      const enemies = [...state.enemies];
      const updated = { ...enemies[i], ...data };

      // Keep activeUltCooldown in sync whenever level or cooldowns change.
      updated.activeUltCooldown = deriveActiveUltCooldown(
        updated.currentLevel,
        updated.ultBaseCooldowns
      );

      enemies[i] = updated;
      return { enemies };
    });
  },

  clearChampion(index: number) {
    const i = validIndex(index);
    if (i === null) return;

    set((state) => {
      const enemies = [...state.enemies];
      enemies[i] = createEmptyChampion();
      return { enemies };
    });
  },

  // ---- Level toggle -------------------------------------------------------
  cycleLevel(index: number) {
    const i = validIndex(index);
    if (i === null) return;

    set((state) => {
      const enemies = [...state.enemies];
      const champ = { ...enemies[i] };

      const currentIdx = LEVEL_CYCLE.indexOf(champ.currentLevel);
      const nextIdx = (currentIdx + 1) % LEVEL_CYCLE.length;
      champ.currentLevel = LEVEL_CYCLE[nextIdx];

      // Automatically update the active ult cooldown for the new level.
      champ.activeUltCooldown = deriveActiveUltCooldown(
        champ.currentLevel,
        champ.ultBaseCooldowns
      );

      enemies[i] = champ;
      return { enemies };
    });
  },

  // ---- Ability Haste ------------------------------------------------------
  setAbilityHaste(index: number, haste: number) {
    const i = validIndex(index);
    if (i === null) return;

    set((state) => {
      const enemies = [...state.enemies];
      enemies[i] = { ...enemies[i], abilityHaste: haste };
      return { enemies };
    });
  },

  // ---- Timers -------------------------------------------------------------
  startUltTimer(index: number) {
    const i = validIndex(index);
    if (i === null) return;

    const { enemies, calculateCooldown } = get();
    const champ = enemies[i];

    if (champ.activeUltCooldown === null) return; // no ult at level 1

    const effectiveCD = calculateCooldown(
      champ.activeUltCooldown,
      champ.abilityHaste
    );

    set((state) => {
      const updated = [...state.enemies];
      updated[i] = {
        ...updated[i],
        ultEndTime: Date.now() + effectiveCD * 1000,
      };
      return { enemies: updated };
    });
  },

  startSpellTimer(
    index: number,
    spellSlot: 1 | 2,
    baseCooldown: number
  ) {
    const i = validIndex(index);
    if (i === null) return;

    // NOTE: Summoner spell haste is a separate stat in League; for simplicity
    // we apply the champion's ability haste here. Swap in a dedicated haste
    // value later if needed.
    const { enemies, calculateCooldown } = get();
    const effectiveCD = calculateCooldown(
      baseCooldown,
      enemies[i].abilityHaste
    );

    const endTime = Date.now() + effectiveCD * 1000;
    const key: keyof EnemyChampion =
      spellSlot === 1 ? "spell1EndTime" : "spell2EndTime";

    set((state) => {
      const updated = [...state.enemies];
      updated[i] = { ...updated[i], [key]: endTime };
      return { enemies: updated };
    });
  },

  clearUltTimer(index: number) {
    const i = validIndex(index);
    if (i === null) return;

    set((state) => {
      const updated = [...state.enemies];
      updated[i] = { ...updated[i], ultEndTime: null };
      return { enemies: updated };
    });
  },

  clearSpellTimer(index: number, spellSlot: 1 | 2) {
    const i = validIndex(index);
    if (i === null) return;

    const key: keyof EnemyChampion =
      spellSlot === 1 ? "spell1EndTime" : "spell2EndTime";

    set((state) => {
      const updated = [...state.enemies];
      updated[i] = { ...updated[i], [key]: null };
      return { enemies: updated };
    });
  },

  resetAll() {
    set({ enemies: Array.from({ length: 5 }, createEmptyChampion) });
  },
}));
