import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

// ---------------------------------------------------------------------------
// Clock‑Sync countdown hook
// ---------------------------------------------------------------------------
//
// Instead of naively decrementing a counter every 1 000 ms (which drifts and
// freezes while the app is backgrounded), every tick recalculates the
// remaining time from `Date.now()` vs. the absolute `endTime` stored in
// Zustand.  An `AppState` listener forces an immediate re‑sync whenever the
// user returns to the app – so even if the phone was locked for 30 seconds
// the display will be correct the instant it reappears.
// ---------------------------------------------------------------------------

/**
 * Returns the whole seconds remaining until `endTime`.
 *
 * - Returns **0** when inactive (`endTime === null`) or expired.
 * - Ticks every second via `setInterval`, but each tick is clock‑synced
 *   (`Date.now()` vs `endTime`), so it never drifts.
 * - Automatically re‑syncs when the app transitions back to the foreground.
 * - Stops its own interval once the timer reaches 0 to avoid wasted work.
 */
export function useCountdown(endTime: number | null): number {
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // ── Inactive timer ────────────────────────────────────────────
    if (endTime === null) {
      setRemaining(0);
      return;
    }

    // ── Clock‑synced tick ─────────────────────────────────────────
    const tick = () => {
      const diff = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setRemaining(diff);

      // Once expired, stop ticking to save resources.
      if (diff === 0 && intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Synchronise immediately, then once per second.
    tick();
    intervalRef.current = setInterval(tick, 1000);

    // ── AppState re‑sync (covers background → foreground) ────────
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        tick();

        // Restart the interval if the timer hasn't expired yet.
        if (endTime - Date.now() > 0 && intervalRef.current === null) {
          intervalRef.current = setInterval(tick, 1000);
        }
      }
    };

    const subscription = AppState.addEventListener("change", handleAppState);

    // ── Cleanup ──────────────────────────────────────────────────
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      subscription.remove();
    };
  }, [endTime]);

  return remaining;
}
