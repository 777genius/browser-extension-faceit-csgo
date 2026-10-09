// FACEIT API Configuration
export const FACEIT_API = {
  BASE_URL: 'https://open.faceit.com/data/v4',
  TOKEN: 'Bearer 8c142d35-ba07-4de6-a14a-9f1e3e6109e8',
  HEADERS: {
    accept: 'application/json',
    Authorization: 'Bearer 8c142d35-ba07-4de6-a14a-9f1e3e6109e8'
  }
}

// Game constants
export const GAMES = {
  CSGO: 'csgo',
  CS2: 'cs2',
  OW2: 'ow2'
}

// API Limits
export const API_LIMITS = {
  MATCHES_PER_PAGE: 10,
  MAX_RETRIES: 3
}
