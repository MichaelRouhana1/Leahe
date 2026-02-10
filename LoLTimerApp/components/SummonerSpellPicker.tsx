import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { X } from "lucide-react-native";

import {
  fetchSummonerSpells,
  getSummonerSpellIconUrl,
  type DataDragonSummonerSpellEntry,
} from "@/constants/dataDragon";
import { useTimerStore } from "@/store/useTimerStore";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VERSION = "14.3.1";

const C = {
  overlayBg: "rgba(0, 0, 0, 0.6)",
  panelBg: "#0A1428",
  border: "#1E2328",
  gold: "#C89B3C",
  teal: "#0AC8B9",
  textPrimary: "#F0E6D2",
  textSecondary: "#A09B8C",
  textMuted: "#5B5A56",
  rowHover: "rgba(200, 155, 60, 0.12)",
} as const;

// Module‑level cache – summoner spell list is fetched once.
let spellCache: DataDragonSummonerSpellEntry[] | null = null;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SummonerSpellPickerProps {
  visible: boolean;
  /** Which enemy slot (0–4). */
  index: number;
  /** Which spell slot to assign (1 = D, 2 = F). */
  slot: 1 | 2;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SummonerSpellPicker({
  visible,
  index,
  slot,
  onClose,
}: SummonerSpellPickerProps) {
  const [spells, setSpells] = useState<DataDragonSummonerSpellEntry[]>(
    spellCache ?? [],
  );
  const [loading, setLoading] = useState(spellCache === null);

  // ── Fetch spell list once ───────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (spellCache !== null) {
      setSpells(spellCache);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchSummonerSpells(VERSION)
      .then((list) => {
        if (cancelled) return;
        spellCache = list;
        setSpells(list);
      })
      .catch((err) => {
        if (!cancelled) console.warn("Failed to load summoner spells:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // ── Select a spell ──────────────────────────────────────────────
  const handleSelect = useCallback(
    (spell: DataDragonSummonerSpellEntry) => {
      const cooldown = spell.cooldown[0] ?? 300;
      useTimerStore.getState().setSummonerSpell(index, slot, spell.id, cooldown);
      onClose();
    },
    [index, slot, onClose],
  );

  // ── Render a row ────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: DataDragonSummonerSpellEntry }) => {
      const cd = item.cooldown[0] ?? 0;
      return (
        <Pressable
          onPress={() => handleSelect(item)}
          style={({ pressed }) => [
            styles.row,
            pressed && styles.rowPressed,
          ]}
        >
          <Image
            source={{ uri: getSummonerSpellIconUrl(VERSION, item.id) }}
            style={styles.spellIcon}
            contentFit="cover"
          />
          <Text style={styles.spellName}>{item.name}</Text>
          <Text style={styles.spellCd}>{cd}s</Text>
        </Pressable>
      );
    },
    [handleSelect],
  );

  const keyExtractor = useCallback(
    (item: DataDragonSummonerSpellEntry) => item.id,
    [],
  );

  // ── Layout ──────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.panel} onPress={undefined}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              Spell {slot === 1 ? "D" : "F"}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={18} color={C.textSecondary} />
            </Pressable>
          </View>

          {/* Spell list */}
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="small" color={C.gold} />
            </View>
          ) : (
            <FlatList
              data={spells}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: C.overlayBg,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  panel: {
    width: "100%",
    maxHeight: 380,
    backgroundColor: C.panelBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    overflow: "hidden",
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: C.textPrimary,
  },

  /* List */
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  rowPressed: {
    backgroundColor: C.rowHover,
  },
  spellIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  spellName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: C.textPrimary,
  },
  spellCd: {
    fontSize: 13,
    fontWeight: "600",
    color: C.textMuted,
    fontVariant: ["tabular-nums"],
  },

  /* Utility */
  centered: {
    paddingVertical: 24,
    alignItems: "center",
  },
});
