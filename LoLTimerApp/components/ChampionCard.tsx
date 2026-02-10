import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Cloud, Crosshair, Flame, User } from "lucide-react-native";

import { useTimerStore } from "@/store/useTimerStore";
import {
  getAbilityIconUrl,
  getChampionIconUrl,
  getSummonerSpellIconUrl,
} from "@/constants/dataDragon";
import { TimerCircle } from "@/components/TimerCircle";
import { ChampionSearchModal } from "@/components/ChampionSearchModal";
import { SummonerSpellPicker } from "@/components/SummonerSpellPicker";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPELL_VERSION = "14.3.1";

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

  // ---- Champion search modal ----------------------------------------------
  const [modalVisible, setModalVisible] = useState(false);
  const openModal = useCallback(() => setModalVisible(true), []);
  const closeModal = useCallback(() => setModalVisible(false), []);

  // ---- Ultimate lock / pulse animation ------------------------------------
  const ultLocked = enemy.currentLevel === 1;

  const ultScaleAnim = useRef(new Animated.Value(1)).current;
  const prevLevelRef = useRef(enemy.currentLevel);

  useEffect(() => {
    const prev = prevLevelRef.current;
    prevLevelRef.current = enemy.currentLevel;

    // Only animate when the level actually changed AND the new level has ult.
    if (prev === enemy.currentLevel) return;
    if (enemy.currentLevel === 1) return;

    Animated.sequence([
      Animated.timing(ultScaleAnim, {
        toValue: 1.2,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(ultScaleAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [enemy.currentLevel, ultScaleAnim]);

  // ---- Summoner spell picker ------------------------------------------------
  const [spellPickerSlot, setSpellPickerSlot] = useState<1 | 2 | null>(null);
  const closeSpellPicker = useCallback(() => setSpellPickerSlot(null), []);

  // ---- Derived effective cooldowns (live‑update when AH changes) ----------
  const totalUltHaste = enemy.abilityHaste + enemy.ultimateHaste;
  const effectiveUltCD =
    enemy.activeUltCooldown !== null
      ? calculateCooldown(enemy.activeUltCooldown, totalUltHaste)
      : null;

  const effectiveSpell1CD = calculateCooldown(
    enemy.spell1BaseCooldown,
    enemy.summonerHaste,
  );
  const effectiveSpell2CD = calculateCooldown(
    enemy.spell2BaseCooldown,
    enemy.summonerHaste,
  );

  // ---- Spell icon URIs ----------------------------------------------------
  const ultIconUri = enemy.ultImageName
    ? getAbilityIconUrl(SPELL_VERSION, enemy.ultImageName)
    : null;
  const spell1IconUri = getSummonerSpellIconUrl(SPELL_VERSION, enemy.spell1Id);
  const spell2IconUri = getSummonerSpellIconUrl(SPELL_VERSION, enemy.spell2Id);

  // ---- Handlers -----------------------------------------------------------
  // We read fresh state inside callbacks via getState() so that memoised
  // references never go stale.

  const handleLevelToggle = useCallback(() => {
    useTimerStore.getState().cycleLevel(index);
  }, [index]);

  const handleCycleUltHunter = useCallback(() => {
    useTimerStore.getState().cycleUltimateHunterStacks(index);
  }, [index]);

  const handleToggleMalignance = useCallback(() => {
    useTimerStore.getState().toggleMalignance(index);
  }, [index]);

  const handleToggleCloudSoul = useCallback(() => {
    useTimerStore.getState().toggleCloudSoul(index);
  }, [index]);

  const handleToggleIonian = useCallback(() => {
    useTimerStore.getState().toggleIonianBoots(index);
  }, [index]);

  const handleToggleCosmic = useCallback(() => {
    useTimerStore.getState().toggleCosmicInsight(index);
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
    if (champ.activeUltCooldown === null) return;
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
    state.startSpellTimer(index, 1);
  }, [index]);

  const handleSpell1LongPress = useCallback(() => {
    const state = useTimerStore.getState();
    const champ = state.enemies[index];
    // Running → reset timer
    if (champ.spell1EndTime !== null && champ.spell1EndTime > Date.now()) {
      state.clearSpellTimer(index, 1);
      return;
    }
    // Idle → open spell picker
    setSpellPickerSlot(1);
  }, [index]);

  // -- Spell 2 (F)
  const handleSpell2Press = useCallback(() => {
    const state = useTimerStore.getState();
    const champ = state.enemies[index];
    if (champ.spell2EndTime !== null && champ.spell2EndTime > Date.now()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    state.startSpellTimer(index, 2);
  }, [index]);

  const handleSpell2LongPress = useCallback(() => {
    const state = useTimerStore.getState();
    const champ = state.enemies[index];
    // Running → reset timer
    if (champ.spell2EndTime !== null && champ.spell2EndTime > Date.now()) {
      state.clearSpellTimer(index, 2);
      return;
    }
    // Idle → open spell picker
    setSpellPickerSlot(2);
  }, [index]);

  // ---- Icon URI -----------------------------------------------------------
  const iconUri = hasChampion ? getChampionIconUrl(version, enemy.id) : null;

  // ---- Render -------------------------------------------------------------
  return (
    <View style={styles.card}>
      {/* ── LEFT: Champion icon (tap to select / change) ─────────────── */}
      <Pressable style={styles.iconCol} onPress={openModal}>
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

        <Text style={styles.champName} numberOfLines={1}>
          {hasChampion ? enemy.name : "Select"}
        </Text>
      </Pressable>

      {/* Champion search modal */}
      <ChampionSearchModal
        visible={modalVisible}
        index={index}
        onClose={closeModal}
      />

      {/* Summoner spell picker */}
      <SummonerSpellPicker
        visible={spellPickerSlot !== null}
        index={index}
        slot={spellPickerSlot ?? 1}
        onClose={closeSpellPicker}
      />

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

        {/* Ultimate Haste toggles */}
        <View style={styles.uhRow}>
          {/* Ultimate Hunter – cycles off → 0/5 → 1/5 → … → 5/5 → off */}
          <Pressable
            onPress={handleCycleUltHunter}
            style={[
              styles.uhChip,
              enemy.ultimateHunterStacks >= 0 && styles.uhChipActive,
            ]}
          >
            <Crosshair
              size={9}
              color={
                enemy.ultimateHunterStacks >= 0 ? C.gold : C.textMuted
              }
            />
            <Text
              style={[
                styles.uhChipTxt,
                enemy.ultimateHunterStacks >= 0 && styles.uhChipTxtActive,
              ]}
            >
              {enemy.ultimateHunterStacks >= 0
                ? `${enemy.ultimateHunterStacks}/5`
                : "Off"}
            </Text>
          </Pressable>

          {/* Malignance (+20 UH) */}
          <Pressable
            onPress={handleToggleMalignance}
            style={[
              styles.uhChip,
              enemy.malignance && styles.uhChipActive,
            ]}
          >
            <Flame
              size={9}
              color={enemy.malignance ? C.gold : C.textMuted}
            />
            <Text
              style={[
                styles.uhChipTxt,
                enemy.malignance && styles.uhChipTxtActive,
              ]}
            >
              Mal
            </Text>
          </Pressable>

          {/* Cloud Soul (+25 UH) */}
          <Pressable
            onPress={handleToggleCloudSoul}
            style={[
              styles.uhChip,
              enemy.cloudSoul && styles.cloudChipActive,
            ]}
          >
            <Cloud
              size={9}
              color={enemy.cloudSoul ? "#88C0D0" : C.textMuted}
            />
            <Text
              style={[
                styles.uhChipTxt,
                enemy.cloudSoul && styles.cloudChipTxtActive,
              ]}
            >
              Soul
            </Text>
          </Pressable>
        </View>

        {/* Summoner Haste toggles */}
        <View style={styles.shRow}>
          <Pressable
            onPress={handleToggleIonian}
            style={[
              styles.shToggle,
              enemy.ionianBoots && styles.shToggleActive,
            ]}
          >
            <Text
              style={[
                styles.shToggleTxt,
                enemy.ionianBoots && styles.shToggleTxtActive,
              ]}
            >
              Boots
            </Text>
          </Pressable>
          <Pressable
            onPress={handleToggleCosmic}
            style={[
              styles.shToggle,
              enemy.cosmicInsight && styles.shToggleActive,
            ]}
          >
            <Text
              style={[
                styles.shToggleTxt,
                enemy.cosmicInsight && styles.shToggleTxtActive,
              ]}
            >
              Cosmic
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── RIGHT: Timer circles ────────────────────────────────────── */}
      <View style={styles.timersRow}>
        <Animated.View style={{ transform: [{ scale: ultScaleAnim }] }}>
          <TimerCircle
            label="R"
            endTime={enemy.ultEndTime}
            totalDuration={effectiveUltCD ?? 0}
            color={C.gold}
            effectiveCooldown={effectiveUltCD}
            onPress={handleUltPress}
            onLongPress={handleUltLongPress}
            disabled={ultLocked}
            iconUri={ultIconUri}
          />
        </Animated.View>
        <TimerCircle
          label="D"
          endTime={enemy.spell1EndTime}
          totalDuration={effectiveSpell1CD}
          color={C.teal}
          effectiveCooldown={effectiveSpell1CD}
          onPress={handleSpell1Press}
          onLongPress={handleSpell1LongPress}
          iconUri={spell1IconUri}
        />
        <TimerCircle
          label="F"
          endTime={enemy.spell2EndTime}
          totalDuration={effectiveSpell2CD}
          color={C.teal}
          effectiveCooldown={effectiveSpell2CD}
          onPress={handleSpell2Press}
          onLongPress={handleSpell2LongPress}
          iconUri={spell2IconUri}
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

  /* ── Summoner Haste toggles ──────────────────────────────────── */
  shRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 2,
  },
  shToggle: {
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 5,
    backgroundColor: "transparent",
  },
  shToggleActive: {
    borderColor: C.teal,
    backgroundColor: "rgba(10, 200, 185, 0.15)",
  },
  shToggleTxt: {
    fontSize: 8,
    fontWeight: "600",
    color: C.textMuted,
  },
  shToggleTxtActive: {
    color: C.teal,
  },
  /* ── Ultimate Haste chips ─────────────────────────────────────── */
  uhRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: 2,
  },
  uhChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
    backgroundColor: "transparent",
  },
  uhChipActive: {
    borderColor: C.gold,
    backgroundColor: "rgba(200, 155, 60, 0.15)",
  },
  uhChipTxt: {
    fontSize: 7,
    fontWeight: "700",
    color: C.textMuted,
  },
  uhChipTxtActive: {
    color: C.gold,
  },
  cloudChipActive: {
    borderColor: "#88C0D0",
    backgroundColor: "rgba(136, 192, 208, 0.15)",
  },
  cloudChipTxtActive: {
    color: "#88C0D0",
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
