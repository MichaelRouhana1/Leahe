import React, { useCallback } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { User } from "lucide-react-native";

import { useTimerStore } from "@/store/useTimerStore";
import { getChampionIconUrl } from "@/constants/dataDragon";
import { TimerCircle } from "@/components/TimerCircle";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default summoner‑spell base cooldown in seconds (Flash). */
const DEFAULT_SPELL_CD = 300;

// LoL‑client‑inspired dark palette
const C = {
  cardBg: "#091428",
  cardBorder: "#1E2328",
  gold: "#C89B3C",
  goldDark: "#463714",
  teal: "#0AC8B9",
  textPrimary: "#F0E6D2",
  textSecondary: "#A09B8C",
  textMuted: "#5B5A56",
  inputBg: "#0A1428",
  inputBorder: "#1E2328",
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChampionCardProps {
  /** Index into the store's `enemies` array (0–4). */
  index: number;
  /** Data Dragon patch version used for icon URLs. */
  version?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChampionCard({ index, version = "14.3.1" }: ChampionCardProps) {
  // ---- Store selectors ----------------------------------------------------
  const enemy = useTimerStore((s) => s.enemies[index]);
  const calculateCooldown = useTimerStore((s) => s.calculateCooldown);

  const hasChampion = enemy.id !== "";

  // ---- Derived effective cooldowns (live‑update when AH changes) ----------
  const effectiveUltCD =
    enemy.activeUltCooldown !== null
      ? calculateCooldown(enemy.activeUltCooldown, enemy.abilityHaste)
      : null;

  const effectiveSpellCD = calculateCooldown(
    DEFAULT_SPELL_CD,
    enemy.abilityHaste,
  );

  // ---- Handlers -----------------------------------------------------------
  // We read fresh state inside callbacks via getState() so that memoised
  // references never go stale.

  const handleLevelToggle = useCallback(() => {
    useTimerStore.getState().cycleLevel(index);
  }, [index]);

  const handleHasteChange = useCallback(
    (text: string) => {
      const parsed = parseInt(text, 10);
      useTimerStore
        .getState()
        .setAbilityHaste(index, Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
    },
    [index],
  );

  // -- Ult timer
  const handleUltPress = useCallback(() => {
    const state = useTimerStore.getState();
    const champ = state.enemies[index];
    if (champ.activeUltCooldown === null) return; // no ult at lv 1
    // Only start when idle / expired
    if (champ.ultEndTime !== null && champ.ultEndTime > Date.now()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    state.startUltTimer(index);
  }, [index]);

  const handleUltLongPress = useCallback(() => {
    const state = useTimerStore.getState();
    const champ = state.enemies[index];
    if (champ.ultEndTime !== null && champ.ultEndTime > Date.now()) {
      state.clearUltTimer(index);
    }
  }, [index]);

  // -- Spell 1 (D)
  const handleSpell1Press = useCallback(() => {
    const state = useTimerStore.getState();
    const champ = state.enemies[index];
    if (champ.spell1EndTime !== null && champ.spell1EndTime > Date.now()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    state.startSpellTimer(index, 1, DEFAULT_SPELL_CD);
  }, [index]);

  const handleSpell1LongPress = useCallback(() => {
    const state = useTimerStore.getState();
    const champ = state.enemies[index];
    if (champ.spell1EndTime !== null && champ.spell1EndTime > Date.now()) {
      state.clearSpellTimer(index, 1);
    }
  }, [index]);

  // -- Spell 2 (F)
  const handleSpell2Press = useCallback(() => {
    const state = useTimerStore.getState();
    const champ = state.enemies[index];
    if (champ.spell2EndTime !== null && champ.spell2EndTime > Date.now()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    state.startSpellTimer(index, 2, DEFAULT_SPELL_CD);
  }, [index]);

  const handleSpell2LongPress = useCallback(() => {
    const state = useTimerStore.getState();
    const champ = state.enemies[index];
    if (champ.spell2EndTime !== null && champ.spell2EndTime > Date.now()) {
      state.clearSpellTimer(index, 2);
    }
  }, [index]);

  // ---- Icon URI -----------------------------------------------------------
  const iconUri = hasChampion ? getChampionIconUrl(version, enemy.id) : null;

  // ---- Render -------------------------------------------------------------
  return (
    <View style={styles.card}>
      {/* ── LEFT: Champion icon ──────────────────────────────────────── */}
      <View style={styles.iconCol}>
        {iconUri ? (
          <Image
            source={{ uri: iconUri }}
            style={styles.icon}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.icon, styles.iconPlaceholder]}>
            <User size={22} color={C.textMuted} />
          </View>
        )}

        {hasChampion && (
          <Text style={styles.champName} numberOfLines={1}>
            {enemy.name}
          </Text>
        )}
      </View>

      {/* ── CENTRE: Level toggle + Ability Haste ────────────────────── */}
      <View style={styles.centreCol}>
        <Pressable
          onPress={handleLevelToggle}
          style={({ pressed }) => [
            styles.levelBtn,
            pressed && styles.levelBtnPressed,
          ]}
        >
          <Text style={styles.levelTxt}>Lv {enemy.currentLevel}</Text>
        </Pressable>

        <View style={styles.hasteRow}>
          <Text style={styles.hasteLabel}>AH</Text>
          <TextInput
            style={styles.hasteInput}
            value={enemy.abilityHaste > 0 ? String(enemy.abilityHaste) : ""}
            onChangeText={handleHasteChange}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={C.textMuted}
            maxLength={3}
            selectTextOnFocus
          />
        </View>

        {/* Live effective‑CD preview beneath the haste input */}
        {effectiveUltCD !== null && (
          <Text style={styles.cdPreview}>
            R {Math.round(effectiveUltCD)}s
          </Text>
        )}
      </View>

      {/* ── RIGHT: Timer circles ────────────────────────────────────── */}
      <View style={styles.timersRow}>
        <TimerCircle
          label="R"
          endTime={enemy.ultEndTime}
          totalDuration={effectiveUltCD ?? 0}
          color={C.gold}
          effectiveCooldown={effectiveUltCD}
          onPress={handleUltPress}
          onLongPress={handleUltLongPress}
        />
        <TimerCircle
          label="D"
          endTime={enemy.spell1EndTime}
          totalDuration={effectiveSpellCD}
          color={C.teal}
          effectiveCooldown={effectiveSpellCD}
          onPress={handleSpell1Press}
          onLongPress={handleSpell1LongPress}
        />
        <TimerCircle
          label="F"
          endTime={enemy.spell2EndTime}
          totalDuration={effectiveSpellCD}
          color={C.teal}
          effectiveCooldown={effectiveSpellCD}
          onPress={handleSpell2Press}
          onLongPress={handleSpell2LongPress}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  /* ── Card shell ───────────────────────────────────────────────── */
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 10,
  },

  /* ── Left column: icon ────────────────────────────────────────── */
  iconCol: {
    alignItems: "center",
    width: 50,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  iconPlaceholder: {
    backgroundColor: "#0D1B2A",
    alignItems: "center",
    justifyContent: "center",
  },
  champName: {
    marginTop: 3,
    fontSize: 9,
    color: C.textSecondary,
    textAlign: "center",
    maxWidth: 50,
  },

  /* ── Centre column: level + haste ─────────────────────────────── */
  centreCol: {
    alignItems: "center",
    gap: 6,
  },
  levelBtn: {
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 14,
    backgroundColor: "rgba(70, 55, 20, 0.25)",
  },
  levelBtnPressed: {
    backgroundColor: "rgba(70, 55, 20, 0.55)",
  },
  levelTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: C.gold,
  },
  hasteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  hasteLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: C.textMuted,
  },
  hasteInput: {
    width: 38,
    height: 26,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 6,
    color: C.textPrimary,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 0,
    paddingHorizontal: 4,
  },
  cdPreview: {
    fontSize: 9,
    color: C.textMuted,
    fontVariant: ["tabular-nums"],
  },

  /* ── Right: timer circles ─────────────────────────────────────── */
  timersRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
  },
});
