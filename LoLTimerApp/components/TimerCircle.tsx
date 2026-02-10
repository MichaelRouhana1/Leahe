import React, { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";

import { useCountdown } from "@/hooks/useCountdown";

// ---- Circle geometry ------------------------------------------------------
const RADIUS = 26;
const STROKE_WIDTH = 3.5;
const SIZE = (RADIUS + STROKE_WIDTH) * 2; // total viewbox size
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ---- Helpers --------------------------------------------------------------

/** Format seconds as "M:SS" (≥ 60 s) or plain seconds (< 60 s). */
function formatTime(seconds: number): string {
  if (seconds <= 0) return "0";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}`;
}

// ---- Props ----------------------------------------------------------------

export interface TimerCircleProps {
  /** Short keybind label shown above the countdown, e.g. "R", "D", "F". */
  label: string;
  /** Epoch‑ms when the timer expires, or `null` when idle. */
  endTime: number | null;
  /** The full effective duration (seconds) – used to derive the progress arc. */
  totalDuration: number;
  /** Accent colour for the progress arc. */
  color: string;
  /**
   * Effective cooldown (seconds) shown inside the circle when idle.
   * Pass `null` to display "—" (e.g. no ult at level 1).
   */
  effectiveCooldown: number | null;
  /** Called on a normal press (start the timer). */
  onPress: () => void;
  /** Called on a long‑press (reset a running timer). */
  onLongPress: () => void;
}

// ---- Component ------------------------------------------------------------

export function TimerCircle({
  label,
  endTime,
  totalDuration,
  color,
  effectiveCooldown,
  onPress,
  onLongPress,
}: TimerCircleProps) {
  const remaining = useCountdown(endTime);
  const isActive = endTime !== null && remaining > 0;

  // ── Haptic: "success" vibration when a running timer hits zero ──
  const prevRemainingRef = useRef(remaining);
  useEffect(() => {
    if (prevRemainingRef.current > 0 && remaining === 0 && endTime !== null) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevRemainingRef.current = remaining;
  }, [remaining, endTime]);

  // Progress: 1 = full circle, 0 = empty.
  const progress =
    isActive && totalDuration > 0 ? remaining / totalDuration : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  // Text shown inside the circle.
  const displayText = isActive
    ? formatTime(remaining)
    : effectiveCooldown !== null
      ? `${Math.round(effectiveCooldown)}s`
      : "—";

  const cx = SIZE / 2;
  const cy = SIZE / 2;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={styles.wrapper}
    >
      <Svg width={SIZE} height={SIZE}>
        {/* Background ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={RADIUS}
          stroke="#1E2328"
          strokeWidth={STROKE_WIDTH}
          fill="#0A1428"
        />
        {/* Animated progress arc (only while counting down) */}
        {isActive && (
          <Circle
            cx={cx}
            cy={cy}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            fill="transparent"
            strokeDasharray={`${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${cx}, ${cy}`}
          />
        )}
        {/* Subtle coloured ring when idle and spell is available */}
        {!isActive && effectiveCooldown !== null && (
          <Circle
            cx={cx}
            cy={cy}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            fill="transparent"
            opacity={0.2}
          />
        )}
      </Svg>

      {/* Centred label + countdown */}
      <View style={styles.overlay} pointerEvents="none">
        <Text
          style={[
            styles.label,
            { color: isActive ? color : "#A09B8C" },
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            styles.time,
            { color: isActive ? "#F0E6D2" : "#5B5A56" },
          ]}
        >
          {displayText}
        </Text>
      </View>
    </Pressable>
  );
}

// ---- Styles ---------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  time: {
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
