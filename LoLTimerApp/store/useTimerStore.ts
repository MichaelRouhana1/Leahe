import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

  // ---- Summoner‑spell haste (separate from ability haste) -------------------
  /** Whether Ionian Boots of Lucidity are assumed (+12 Summoner Spell Haste). */
  ionianBoots: boolean;
  /** Whether Cosmic Insight rune is assumed (+18 Summoner Spell Haste). */
  cosmicInsight: boolean;
  /**
   * Derived Summoner Spell Haste:
   *   (ionianBoots ? 12 : 0) + (cosmicInsight ? 18 : 0)
   * Kept in sync by `toggleIonianBoots` / `toggleCosmicInsight`.
   */
  summonerHaste: number;

  // ---- Summoner spells ------------------------------------------------------
  /** Data Dragon id for summoner spell 1, e.g. "SummonerFlash". */
  spell1Id: string;
  /** Data Dragon id for summoner spell 2. */
  spell2Id: string;
  /** Base cooldown of spell 1 in seconds. */
  spell1BaseCooldown: number;
  /** Base cooldown of spell 2 in seconds. */
  spell2BaseCooldown: number;

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

  /**
   * Populate a slot from a Data Dragon champion‑detail response.
   *
   * Extracts `id`, `name`, and the Ultimate cooldowns (4th spell,
   * `spells[3].cooldown`) into `ultBaseCooldowns`.  Resets the slot to
   * level 6, 0 haste, and no running timers.
   */
  setChampionData: (
    index: number,
    detail: {
      id: string;
      name: string;
      spells: Array<{ cooldown: number[] }>;
    },
  ) => void;

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

  // ---- Summoner haste toggles -----------------------------------------------
  /** Toggle Ionian Boots of Lucidity (+12 Summoner Spell Haste). */
  toggleIonianBoots: (index: number) => void;
  /** Toggle Cosmic Insight rune (+18 Summoner Spell Haste). */
  toggleCosmicInsight: (index: number) => void;

  // ---- Summoner spell selection ---------------------------------------------
  /**
   * Assign a summoner spell to a slot.
   * Resets the timer for that slot if one was running.
   */
  setSummonerSpell: (
    index: number,
    slot: 1 | 2,
    spellId: string,
    cooldown: number,
  ) => void;

  // ---- Timers -------------------------------------------------------------
  /** Start the ultimate timer for the champion at `index`. */
  startUltTimer: (index: number) => void;

  /**
   * Start a summoner spell timer.
   * Reads the base cooldown from the stored spell data for the given slot.
   */
  startSpellTimer: (index: number, spellSlot: 1 | 2) => void;

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
    ionianBoots: false,
    cosmicInsight: false,
    summonerHaste: 0,
    spell1Id: "SummonerFlash",
    spell2Id: "SummonerFlash",
    spell1BaseCooldown: 300,
    spell2BaseCooldown: 300,
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

/** Derive summonerHaste from the two toggle booleans. */
function deriveSummonerHaste(ionianBoots: boolean, cosmicInsight: boolean): number {
  return (ionianBoots ? 12 : 0) + (cosmicInsight ? 18 : 0);
}

/** Clamp `index` to [0, 4] and return it, or `null` if out of range. */
function validIndex(index: number): number | null {
  if (index < 0 || index > 4) return null;
  return index;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTimerStore = create<TimerStoreState>()(
  persist(
    (set, get) => ({
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

  setChampionData(
    index: number,
    detail: {
      id: string;
      name: string;
      spells: Array<{ cooldown: number[] }>;
    },
  ) {
    const i = validIndex(index);
    if (i === null) return;

    // The Ultimate is the 4th spell (index 3).
    const ultSpell = detail.spells[3];
    const cd = ultSpell?.cooldown ?? [0, 0, 0];
    const ultBaseCooldowns: [number, number, number] = [
      cd[0] ?? 0,
      cd[1] ?? 0,
      cd[2] ?? 0,
    ];

    set((state) => {
      const enemies = [...state.enemies];
      enemies[i] = {
        ...createEmptyChampion(),
        id: detail.id,
        name: detail.name,
        ultBaseCooldowns,
        currentLevel: 6,
        // Level 6 → index 0 of ultBaseCooldowns
        activeUltCooldown: ultBaseCooldowns[0],
      };
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

      // Update `activeUltCooldown` for the new level.  This value is used
      // the *next* time a timer is started — any already‑running timer
      // continues counting down to its original `ultEndTime` unaffected.
      champ.activeUltCooldown = deriveActiveUltCooldown(
        champ.currentLevel,
        champ.ultBaseCooldowns,
      );

      // NOTE: `ultEndTime` is intentionally left unchanged so a running
      // timer is never interrupted by a level toggle.

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

  // ---- Summoner haste toggles -----------------------------------------------
  toggleIonianBoots(index: number) {
    const i = validIndex(index);
    if (i === null) return;

    set((state) => {
      const enemies = [...state.enemies];
      const champ = { ...enemies[i] };
      champ.ionianBoots = !champ.ionianBoots;
      champ.summonerHaste = deriveSummonerHaste(champ.ionianBoots, champ.cosmicInsight);
      enemies[i] = champ;
      return { enemies };
    });
  },

  toggleCosmicInsight(index: number) {
    const i = validIndex(index);
    if (i === null) return;

    set((state) => {
      const enemies = [...state.enemies];
      const champ = { ...enemies[i] };
      champ.cosmicInsight = !champ.cosmicInsight;
      champ.summonerHaste = deriveSummonerHaste(champ.ionianBoots, champ.cosmicInsight);
      enemies[i] = champ;
      return { enemies };
    });
  },

  // ---- Summoner spell selection ---------------------------------------------
  setSummonerSpell(
    index: number,
    slot: 1 | 2,
    spellId: string,
    cooldown: number,
  ) {
    const i = validIndex(index);
    if (i === null) return;

    const idKey: keyof EnemyChampion =
      slot === 1 ? "spell1Id" : "spell2Id";
    const cdKey: keyof EnemyChampion =
      slot === 1 ? "spell1BaseCooldown" : "spell2BaseCooldown";
    const endKey: keyof EnemyChampion =
      slot === 1 ? "spell1EndTime" : "spell2EndTime";

    set((state) => {
      const enemies = [...state.enemies];
      enemies[i] = {
        ...enemies[i],
        [idKey]: spellId,
        [cdKey]: cooldown,
        [endKey]: null, // reset any running timer for this slot
      };
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

  startSpellTimer(index: number, spellSlot: 1 | 2) {
    const i = validIndex(index);
    if (i === null) return;

    const { enemies, calculateCooldown } = get();
    const champ = enemies[i];

    const baseCooldown =
      spellSlot === 1 ? champ.spell1BaseCooldown : champ.spell2BaseCooldown;
    if (baseCooldown <= 0) return; // no spell assigned

    // Summoner Spell Haste is separate from Ability Haste in League.
    // It comes from Ionian Boots (+12) and Cosmic Insight (+18).
    const effectiveCD = calculateCooldown(baseCooldown, champ.summonerHaste);

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
    }),
    {
      name: "lol-timer-store",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,

      // Only persist the `enemies` data array — actions are re‑created by
      // Zustand on every mount and don't need serialisation.
      partialize: (state) =>
        ({ enemies: state.enemies }) as unknown as TimerStoreState,

      // After rehydration, clear any timer end‑times that are already in the
      // past so the UI doesn't flash a stale countdown on re‑open.
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return;
        const now = Date.now();
        const cleaned = state.enemies.map((champ) => ({
          ...champ,
          ultEndTime:
            champ.ultEndTime && champ.ultEndTime > now
              ? champ.ultEndTime
              : null,
          spell1EndTime:
            champ.spell1EndTime && champ.spell1EndTime > now
              ? champ.spell1EndTime
              : null,
          spell2EndTime:
            champ.spell2EndTime && champ.spell2EndTime > now
              ? champ.spell2EndTime
              : null,
        }));
        useTimerStore.setState({ enemies: cleaned });
      },
    },
  ),
);
