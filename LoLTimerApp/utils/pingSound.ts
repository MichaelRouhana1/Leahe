import { Audio } from "expo-av";

// ---------------------------------------------------------------------------
// Tiny utility for the "timer expired" ping sound.
//
// The sound is a short 880 Hz sine beep bundled at assets/sounds/ping.wav.
// Replace the file with any short audio clip you prefer.
// ---------------------------------------------------------------------------

let sound: Audio.Sound | null = null;
let loaded = false;

/**
 * Pre‑load the ping sound into memory so `playPing()` is instant.
 * Safe to call multiple times — only loads once.
 */
export async function loadPingSound(): Promise<void> {
  if (loaded) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sound: s } = await Audio.Sound.createAsync(
      require("@/assets/sounds/ping.wav"),
      { shouldPlay: false, volume: 0.6 },
    );
    sound = s;
    loaded = true;
  } catch {
    // Sound file missing or audio unavailable — fail silently.
    loaded = true; // don't retry
  }
}

/**
 * Play the ping sound.  If it hasn't been loaded yet, loads first.
 * Never throws — audio failures are silently swallowed.
 */
export async function playPing(): Promise<void> {
  try {
    if (!loaded) await loadPingSound();
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // swallow
  }
}

/**
 * Release the sound from memory (call on unmount if needed).
 */
export async function unloadPingSound(): Promise<void> {
  if (sound) {
    try {
      await sound.unloadAsync();
    } catch {
      // swallow
    }
    sound = null;
    loaded = false;
  }
}
