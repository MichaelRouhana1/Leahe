// ---------------------------------------------------------------------------
// Data Dragon – Riot's static‑data CDN for League of Legends
// Docs: https://developer.riotgames.com/docs/lol#data-dragon
// ---------------------------------------------------------------------------

const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";
const VERSIONS_URL = `${DDRAGON_BASE}/api/versions.json`;
const FALLBACK_VERSION = "14.3.1";

// ---- Types ----------------------------------------------------------------

/** Shape of a single champion entry inside the champion list JSON. */
export interface DataDragonChampionEntry {
  id: string; // e.g. "Aatrox"
  key: string; // e.g. "266"  (numeric string)
  name: string; // e.g. "Aatrox"
  title: string;
  image: {
    full: string; // e.g. "Aatrox.png"
    sprite: string;
    group: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface DataDragonChampionList {
  type: string;
  format: string;
  version: string;
  data: Record<string, DataDragonChampionEntry>;
}

// ---- Helpers --------------------------------------------------------------

/**
 * Fetch the latest patch version string from Data Dragon.
 * Falls back to `FALLBACK_VERSION` on network errors.
 */
export async function fetchLatestVersion(): Promise<string> {
  try {
    const res = await fetch(VERSIONS_URL);
    if (!res.ok) return FALLBACK_VERSION;
    const versions: string[] = await res.json();
    return versions[0] ?? FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}

/**
 * Build the champion‑list URL for a given patch version.
 */
export function getChampionListUrl(version: string): string {
  return `${DDRAGON_BASE}/cdn/${version}/data/en_US/champion.json`;
}

/**
 * Build the square icon URL for a champion.
 * Example: `getChampionIconUrl("14.3.1", "Aatrox")` →
 *   https://ddragon.leagueoflegends.com/cdn/14.3.1/img/champion/Aatrox.png
 */
export function getChampionIconUrl(version: string, championId: string): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/champion/${championId}.png`;
}

// ---- Main fetch -----------------------------------------------------------

/**
 * Fetch the full champion list from Data Dragon.
 *
 * • If `version` is omitted the latest patch is resolved automatically.
 * • Returns the parsed `DataDragonChampionList` payload which includes every
 *   champion keyed by their string id (e.g. `data["Aatrox"]`).
 *
 * @example
 * ```ts
 * const { data, version } = await fetchChampionData();
 * const aatrox = data["Aatrox"];
 * ```
 */
export async function fetchChampionData(
  version?: string
): Promise<DataDragonChampionList> {
  const patchVersion = version ?? (await fetchLatestVersion());
  const url = getChampionListUrl(patchVersion);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch champion data (HTTP ${res.status}) from ${url}`
    );
  }

  const json: DataDragonChampionList = await res.json();
  return json;
}
