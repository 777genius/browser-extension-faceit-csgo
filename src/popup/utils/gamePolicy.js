// FACEIT game ids are shared by selection, profiles and requests.
export const GAME_OPTIONS = [
  { value: 'csgo', name: 'CS:GO', image: 'https://assets.faceit-cdn.net/third_party/games/4f899245-2fa8-4e52-ad9a-4a363613c19e/assets/details/csgo_flag_s_1589795160776.jpg' },
  { value: 'cs2', name: 'CS2', image: 'https://distribution.faceit-cdn.net/images/ea5c4171-712f-4afd-a8ae-3fb5e1e2afb8.jpeg?width=24&height=24' },
  { value: 'ow2', name: 'Overwatch 2', image: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#252525"/><circle cx="16" cy="16" r="10" fill="none" stroke="#fff" stroke-width="3"/><path d="M9 7a12 12 0 0 1 14 0" fill="none" stroke="#f50" stroke-width="3"/><path d="M16 12v7l-7 6m7-6 7 6" fill="none" stroke="#fff" stroke-width="3"/></svg>') }
]

export function normalizeGame (game) {
  return GAME_OPTIONS.some(option => option.value === game) ? game : 'csgo'
}

export function validSkillLevel (value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const level = Number(value)
  return Number.isInteger(level) && level >= 1 && level <= 10 ? level : null
}

export function getGameProfile (player, game) {
  const games = (player && player.games) || {}
  // An absent OW2 profile must never acquire Counter-Strike rank data.
  return games[game] || (game === 'ow2' ? null : games.csgo || games.cs2 || null)
}

export const OW2_ELO_RANGES = [
  [100, 500], [501, 750], [751, 900], [901, 1050], [1051, 1200],
  [1201, 1350], [1351, 1530], [1531, 1750], [1751, 2000], [2001, Infinity]
]

export function getOw2Rank (profile) {
  const level = validSkillLevel(profile && profile.skill_level)
  const rawElo = profile && profile.faceit_elo
  const elo = typeof rawElo === 'number' || (typeof rawElo === 'string' && rawElo.trim()) ? Number(rawElo) : null
  const range = level ? OW2_ELO_RANGES[level - 1] : null
  if (!range || !Number.isFinite(elo)) return { level, elo: Number.isFinite(elo) ? elo : null, range: null }
  const next = level < 10 ? OW2_ELO_RANGES[level][0] : null
  return {
    level, elo, range,
    progress: next ? Math.max(0, Math.min(100, Math.floor((elo - range[0]) / (next - range[0]) * 100))) : 100,
    toNext: next ? Math.max(0, next - elo) : null,
    toLose: level > 1 ? Math.max(0, elo - OW2_ELO_RANGES[level - 2][1]) : null
  }
}

// Exact FACEIT OW2 keys differ from CS, including casing and plural K/D ratios.
export const OW2_METRICS = [
  { key: 'Matches', label: 'matches' },
  { key: 'Wins', label: 'wins' },
  { key: 'Win rate %', label: 'winRate', suffix: '%' },
  { key: 'Average K/D ratios', label: 'ow2AverageKD' },
  { key: 'Eliminations', label: 'ow2Eliminations' },
  { key: 'Deaths', label: 'totalDeaths' },
  { key: 'Average Eliminations', label: 'ow2AverageEliminations' },
  { key: 'Average Deaths', label: 'averageDeaths' },
  { key: 'Average Damage Dealt', label: 'ow2Damage' },
  { key: 'Average Healing Done', label: 'ow2Healing' },
  { key: 'Average Damage Mitigated', label: 'ow2Mitigation' },
  { key: 'Average Final Blows', label: 'ow2FinalBlows' },
  { key: 'Matches with new stats', label: 'ow2MatchesWithStats' },
  { key: 'Current Win Streak', label: 'currentWinStreak' },
  { key: 'Longest Win Streak', label: 'longestWinStreak' }
]

export function getOw2Metrics (stats = {}) {
  return OW2_METRICS.filter(metric => stats[metric.key] !== undefined && stats[metric.key] !== null && stats[metric.key] !== '')
    .map(metric => ({ ...metric, value: String(stats[metric.key]) + (metric.suffix || '') }))
}

export function getOw2Maps (stats) {
  return ((stats && stats.segments) || []).filter(segment => segment.type === 'Map' && segment.label)
}

export function favoriteGame (favorite) {
  // Entries saved before game metadata was introduced were CS:GO favorites.
  return normalizeGame(favorite && favorite.game)
}

export function favoriteKey (favorite) {
  return favorite.player_id + ':' + favoriteGame(favorite)
}
