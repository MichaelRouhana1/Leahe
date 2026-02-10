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

/** Shape of a single spell inside the champion‑detail JSON. */
export interface DataDragonSpellEntry {
  id: string;
  name: string;
  description: string;
  cooldown: number[]; // one value per rank, e.g. [100, 80, 60]
  cooldownBurn: string;
  cost: number[];
  costBurn: string;
  image: {
    full: string;
    sprite: string;
    group: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

/** Shape of a single champion inside the detail JSON. */
export interface DataDragonChampionDetail {
  id: string;
  key: string;
  name: string;
  title: string;
  /** Q / W / E / R – the Ultimate is always index 3. */
  spells: DataDragonSpellEntry[];
}

/** Top‑level wrapper returned by the champion‑detail endpoint. */
export interface DataDragonChampionDetailResponse {
  type: string;
  format: string;
  version: string;
  data: Record<string, DataDragonChampionDetail>;
}

// ---- Summoner spell types -------------------------------------------------

/** Shape of a single summoner spell entry in `summoner.json`. */
export interface DataDragonSummonerSpellEntry {
  id: string;        // e.g. "SummonerFlash"
  key: string;       // e.g. "4"
  name: string;      // e.g. "Flash"
  description: string;
  cooldown: number[]; // single‑element array, e.g. [300]
  image: {
    full: string;     // e.g. "SummonerFlash.png"
    sprite: string;
    group: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };
  modes: string[];   // e.g. ["CLASSIC", "ARAM", ...]
}

export interface DataDragonSummonerSpellList {
  type: string;
  version: string;
  data: Record<string, DataDragonSummonerSpellEntry>;
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

/**
 * Build the summoner‑spell list URL for a given patch version.
 */
export function getSummonerSpellListUrl(version: string): string {
  return `${DDRAGON_BASE}/cdn/${version}/data/en_US/summoner.json`;
}

/**
 * Build the icon URL for a summoner spell.
 * Example: `getSummonerSpellIconUrl("14.3.1", "SummonerFlash")` →
 *   https://ddragon.leagueoflegends.com/cdn/14.3.1/img/spell/SummonerFlash.png
 */
export function getSummonerSpellIconUrl(
  version: string,
  spellId: string,
): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/spell/${spellId}.png`;
}

/**
 * Build the icon URL for a champion ability using its `image.full` name.
 * Unlike `getSummonerSpellIconUrl`, the `imageFullName` param already
 * includes the `.png` extension (e.g. "LuxMaliceCannon.png").
 *
 * Example: `getAbilityIconUrl("14.3.1", "LuxMaliceCannon.png")` →
 *   https://ddragon.leagueoflegends.com/cdn/14.3.1/img/spell/LuxMaliceCannon.png
 */
export function getAbilityIconUrl(
  version: string,
  imageFullName: string,
): string {
  return `${DDRAGON_BASE}/cdn/${version}/img/spell/${imageFullName}`;
}

/**
 * Build the champion‑detail URL for a given champion + patch version.
 * Example: `getChampionDetailUrl("14.3.1", "Aatrox")` →
 *   https://ddragon.leagueoflegends.com/cdn/14.3.1/data/en_US/champion/Aatrox.json
 */
export function getChampionDetailUrl(
  version: string,
  championId: string,
): string {
  return `${DDRAGON_BASE}/cdn/${version}/data/en_US/champion/${championId}.json`;
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

/**
 * Fetch the **detailed** data for a single champion (includes spells, stats,
 * lore, etc.).
 *
 * The Ultimate spell is always `detail.spells[3]`, and its `cooldown` array
 * holds one value per rank (e.g. `[120, 100, 80]`).
 *
 * @example
 * ```ts
 * const lux = await fetchChampionDetails("Lux");
 * const ultCDs = lux.spells[3].cooldown; // [80, 60, 40]
 * ```
 */
export async function fetchChampionDetails(
  championId: string,
  version?: string,
): Promise<DataDragonChampionDetail> {
  const patchVersion = version ?? (await fetchLatestVersion());
  const url = getChampionDetailUrl(patchVersion, championId);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch champion details (HTTP ${res.status}) from ${url}`
    );
  }

  const json: DataDragonChampionDetailResponse = await res.json();
  const detail = json.data[championId];

  if (!detail) {
    throw new Error(`Champion "${championId}" not found in response`);
  }

  return detail;
}

/**
 * Fetch the full summoner‑spell list from Data Dragon.
 *
 * Returns an array of spells sorted alphabetically by `name`, filtered to
 * only those available in **CLASSIC** (Summoner's Rift) mode by default.
 *
 * @example
 * ```ts
 * const spells = await fetchSummonerSpells();
 * // [{ id: "SummonerBarrier", name: "Barrier", cooldown: [180], ... }, ...]
 * ```
 */
export async function fetchSummonerSpells(
  version?: string,
  mode: string = "CLASSIC",
): Promise<DataDragonSummonerSpellEntry[]> {
  const patchVersion = version ?? (await fetchLatestVersion());
  const url = getSummonerSpellListUrl(patchVersion);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch summoner spells (HTTP ${res.status}) from ${url}`,
    );
  }

  const json: DataDragonSummonerSpellList = await res.json();

  return Object.values(json.data)
    .filter((s) => s.modes.includes(mode))
    .sort((a, b) => a.name.localeCompare(b.name));
}
