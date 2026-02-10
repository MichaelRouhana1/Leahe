import React, { useCallback, useEffect } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RotateCcw } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { ChampionCard } from "@/components/ChampionCard";
import { useTimerStore } from "@/store/useTimerStore";
import { loadPingSound } from "@/utils/pingSound";

// LoL‑inspired palette (matches ChampionCard)
const C = {
  screenBg: "#010A13",
  headerBg: "#0A1428",
  gold: "#C89B3C",
  red: "#C8413C",
  redDark: "rgba(200, 65, 60, 0.15)",
  textPrimary: "#F0E6D2",
  textMuted: "#5B5A56",
  border: "#1E2328",
} as const;

const ENEMY_INDICES = [0, 1, 2, 3, 4] as const;

export default function TimerScreen() {
  const insets = useSafeAreaInsets();

  // Pre‑load the ping sound so playback is instant when a timer finishes.
  useEffect(() => {
    loadPingSound();
  }, []);

  const handleResetAll = useCallback(() => {
    Alert.alert(
      "Reset All Timers",
      "Clear all enemy champions and start fresh for a new match?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            useTimerStore.getState().resetAll();
          },
        },
      ],
    );
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Enemy Timers</Text>

        <Pressable
          onPress={handleResetAll}
          style={({ pressed }) => [
            styles.resetBtn,
            pressed && styles.resetBtnPressed,
          ]}
        >
          <RotateCcw size={14} color={C.red} />
          <Text style={styles.resetTxt}>Reset All</Text>
        </Pressable>
      </View>

      {/* ── Champion cards ──────────────────────────────────────────── */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {ENEMY_INDICES.map((i) => (
          <ChampionCard key={i} index={i} />
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.screenBg,
  },

  /* ── Header ──────────────────────────────────────────────────────── */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: C.textPrimary,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: C.redDark,
  },
  resetBtnPressed: {
    backgroundColor: "rgba(200, 65, 60, 0.35)",
  },
  resetTxt: {
    fontSize: 13,
    fontWeight: "600",
    color: C.red,
  },

  /* ── Card list ───────────────────────────────────────────────────── */
  list: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    gap: 10,
  },
});
