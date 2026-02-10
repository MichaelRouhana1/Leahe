import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Search, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchChampionData,
  fetchChampionDetails,
  getChampionIconUrl,
  type DataDragonChampionEntry,
} from "@/constants/dataDragon";
import { useTimerStore } from "@/store/useTimerStore";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLUMNS = 4;
const VERSION = "14.3.1";

const C = {
  bg: "#010A13",
  headerBg: "#0A1428",
  cellBg: "#091428",
  border: "#1E2328",
  gold: "#C89B3C",
  textPrimary: "#F0E6D2",
  textSecondary: "#A09B8C",
  textMuted: "#5B5A56",
  inputBg: "#0A1428",
} as const;

// Module‑level cache so the champion list is only fetched once per session.
let champListCache: DataDragonChampionEntry[] | null = null;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChampionSearchModalProps {
  visible: boolean;
  /** Which enemy slot (0–4) to populate when a champion is selected. */
  index: number;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChampionSearchModal({
  visible,
  index,
  onClose,
}: ChampionSearchModalProps) {
  const insets = useSafeAreaInsets();

  const [champions, setChampions] = useState<DataDragonChampionEntry[]>(
    champListCache ?? [],
  );
  const [search, setSearch] = useState("");
  const [listLoading, setListLoading] = useState(champListCache === null);
  const [selecting, setSelecting] = useState<string | null>(null);

  // ── Fetch champion list (once) when the modal opens ──────────────
  useEffect(() => {
    if (!visible) return;

    // Reset search each time the modal opens.
    setSearch("");

    // Already cached – skip fetch.
    if (champListCache !== null) {
      setChampions(champListCache);
      setListLoading(false);
      return;
    }

    let cancelled = false;
    setListLoading(true);

    fetchChampionData(VERSION)
      .then((result) => {
        if (cancelled) return;
        const sorted = Object.values(result.data).sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        champListCache = sorted;
        setChampions(sorted);
      })
      .catch((err) => {
        if (!cancelled) console.warn("Failed to load champion list:", err);
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // ── Filter by search query ──────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return champions;
    return champions.filter((c) => c.name.toLowerCase().includes(q));
  }, [champions, search]);

  // ── Select a champion ───────────────────────────────────────────
  const handleSelect = useCallback(
    async (champ: DataDragonChampionEntry) => {
      if (selecting) return; // prevent double‑tap
      setSelecting(champ.id);
      try {
        const detail = await fetchChampionDetails(champ.id, VERSION);
        useTimerStore.getState().setChampionData(index, detail);
        onClose();
      } catch (err) {
        console.warn("Failed to fetch champion details:", err);
      } finally {
        setSelecting(null);
      }
    },
    [index, onClose, selecting],
  );

  // ── Render a single grid cell ───────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: DataDragonChampionEntry }) => {
      const isLoading = selecting === item.id;
      return (
        <Pressable
          onPress={() => handleSelect(item)}
          disabled={selecting !== null}
          style={({ pressed }) => [
            styles.cell,
            pressed && styles.cellPressed,
          ]}
        >
          <View style={styles.iconWrapper}>
            <Image
              source={{ uri: getChampionIconUrl(VERSION, item.id) }}
              style={styles.cellIcon}
              contentFit="cover"
              transition={100}
            />
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color={C.gold} />
              </View>
            )}
          </View>
          <Text style={styles.cellName} numberOfLines={1}>
            {item.name}
          </Text>
        </Pressable>
      );
    },
    [handleSelect, selecting],
  );

  const keyExtractor = useCallback(
    (item: DataDragonChampionEntry) => item.id,
    [],
  );

  // ── Layout ──────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>Select Champion</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <X size={22} color={C.textSecondary} />
          </Pressable>
        </View>

        {/* ── Search bar ──────────────────────────────────────────── */}
        <View style={styles.searchRow}>
          <Search size={16} color={C.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search champions…"
            placeholderTextColor={C.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={6}>
              <X size={14} color={C.textMuted} />
            </Pressable>
          )}
        </View>

        {/* ── Grid / loading / empty ──────────────────────────────── */}
        {listLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={C.gold} />
            <Text style={styles.statusTxt}>Loading champions…</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={COLUMNS}
            contentContainerStyle={[
              styles.grid,
              { paddingBottom: insets.bottom + 16 },
            ]}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={styles.statusTxt}>No champions found</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  /* ── Header ───────────────────────────────────────────────────── */
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
    fontSize: 18,
    fontWeight: "700",
    color: C.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },

  /* ── Search ───────────────────────────────────────────────────── */
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.textPrimary,
    paddingVertical: 0,
  },

  /* ── Grid ─────────────────────────────────────────────────────── */
  grid: {
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: 8,
  },
  cellPressed: {
    backgroundColor: "rgba(200, 155, 60, 0.12)",
  },
  iconWrapper: {
    position: "relative",
  },
  cellIcon: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cellName: {
    marginTop: 4,
    fontSize: 10,
    color: C.textSecondary,
    textAlign: "center",
    maxWidth: 60,
  },

  /* ── Utility ──────────────────────────────────────────────────── */
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  statusTxt: {
    marginTop: 12,
    fontSize: 14,
    color: C.textMuted,
  },
});
