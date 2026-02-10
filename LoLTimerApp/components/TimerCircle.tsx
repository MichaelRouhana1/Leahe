import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";

import { useCountdown } from "@/hooks/useCountdown";
import { playPing } from "@/utils/pingSound";

// ---- Circle geometry ------------------------------------------------------
const RADIUS = 26;
const STROKE_WIDTH = 3.5;
const SIZE = (RADIUS + STROKE_WIDTH) * 2; // total viewbox size
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Seconds threshold for the "almost done" warning state. */
const WARNING_THRESHOLD = 10;

const COLORS = {
  red: "#C8413C",
  textActive: "#F0E6D2",
  textIdle: "#5B5A56",
  labelIdle: "#A09B8C",
  ringBg: "#1E2328",
  fillBg: "#0A1428",
} as const;

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
  /**
   * Optional URI for a spell icon shown inside the circle instead of
   * the text label (e.g. a summoner spell icon).
   */
  iconUri?: string | null;
  /**
   * When `true` the circle is "locked":
   * • If idle → renders at 0.4 opacity, presses are ignored.
   * • If a timer is already running → the countdown is still shown
   *   normally (the `endTime` is honoured), but a new timer cannot
   *   be started.  Long‑press reset remains available.
   */
  disabled?: boolean;
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
  iconUri,
  disabled = false,
}: TimerCircleProps) {
  const remaining = useCountdown(endTime);
  const isActive = endTime !== null && remaining > 0;

  // "Locked" visual only applies when disabled AND the timer is idle.
  const isLocked = disabled && !isActive;

  // ── Warning state: < 10 s remaining ─────────────────────────────
  const isWarning = isActive && remaining <= WARNING_THRESHOLD;

  // ── Pulse animation for the warning state ───────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isWarning) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    // Reset to fully opaque when leaving warning zone.
    pulseAnim.setValue(1);
    return undefined;
  }, [isWarning, pulseAnim]);

  // ── Haptic + ping sound when a running timer hits zero ──────────
  const prevRemainingRef = useRef(remaining);
  useEffect(() => {
    if (prevRemainingRef.current > 0 && remaining === 0 && endTime !== null) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playPing();
    }
    prevRemainingRef.current = remaining;
  }, [remaining, endTime]);

  // ── Derived visuals ─────────────────────────────────────────────
  // Progress: 1 = full circle, 0 = empty.
  const progress =
    isActive && totalDuration > 0 ? remaining / totalDuration : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  // Arc colour turns red in warning zone.
  const arcColor = isWarning ? COLORS.red : color;

  // Text colour: red when warning, gold/teal when active, muted when idle.
  const timeColor = isWarning
    ? COLORS.red
    : isActive
      ? COLORS.textActive
      : COLORS.textIdle;

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
      onPress={disabled ? undefined : onPress}
      onLongPress={onLongPress} // always allow long‑press reset
      delayLongPress={400}
      style={[styles.wrapper, isLocked && styles.locked]}
    >
      <Svg width={SIZE} height={SIZE}>
        {/* Background ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={RADIUS}
          stroke={COLORS.ringBg}
          strokeWidth={STROKE_WIDTH}
          fill={COLORS.fillBg}
        />
        {/* Progress arc (only while counting down) */}
        {isActive && (
          <Circle
            cx={cx}
            cy={cy}
            r={RADIUS}
            stroke={arcColor}
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

      {/* Centred label / icon + countdown */}
      <View style={styles.overlay} pointerEvents="none">
        {iconUri ? (
          <Image
            source={{ uri: iconUri }}
            style={styles.spellIcon}
            contentFit="cover"
          />
        ) : (
          <Text
            style={[
              styles.label,
              { color: isActive ? arcColor : COLORS.labelIdle },
            ]}
          >
            {label}
          </Text>
        )}

        {/* Countdown / idle text — pulses in warning zone */}
        <Animated.Text
          style={[
            styles.time,
            { color: timeColor },
            isWarning && { opacity: pulseAnim },
          ]}
        >
          {displayText}
        </Animated.Text>
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
  locked: {
    opacity: 0.4,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  spellIcon: {
    width: 16,
    height: 16,
    borderRadius: 3,
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
