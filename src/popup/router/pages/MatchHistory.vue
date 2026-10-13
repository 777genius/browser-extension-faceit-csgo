<template>
  <div v-if="player">
    <p v-if="selectedGame === 'ow2'" class="source-note">{{ $browser.i18n.getMessage('ow2Source') || 'FACEIT Overwatch 2 statistics. FACEIT Elo is separate from Blizzard competitive rank.' }}</p>
    <div v-if="selectedGame === 'ow2' && !gameProfile" class="ow2-empty">{{ $browser.i18n.getMessage('ow2NoGame') || 'This player has no Overwatch 2 profile on FACEIT.' }}</div>
    <template v-else>
    <!-- Recent Results Summary -->
    <div class="results-summary">
      <h3>{{ $browser.i18n.getMessage('recentResults') }}</h3>

      <!-- W/L кружки для последних матчей -->
      <div
        v-if="recentMatches.length > 0"
        class="recent-wl-circles"
      >
        <div
          v-for="(match, index) in recentMatches"
          :key="`recent-circle-${index}-${match.match_id}`"
          :class="['wl-circle', getMatchResult(match)]"
          :title="getMatchResultText(match)"
          @click="goToSpecificMatch(index)"
        >
          {{ getMatchResultLetter(match) }}
        </div>
      </div>
    </div>

    <!-- Match History List -->
    <div class="match-history">
      <h3>{{ $browser.i18n.getMessage('detailedMatchHistory') }}</h3>

      <!-- Loading state -->
      <div
        v-if="isLoadingMatches"
        class="loading-state"
      >
        <div class="spinner" />
        <p>{{ $browser.i18n.getMessage('loadingMatches') || 'Загрузка матчей...' }}</p>
      </div>

      <div v-else-if="matchesError" class="matches-error" role="alert">
        <p>{{ $browser.i18n.getMessage('loadingErrorDescription') || 'Could not load matches. Check your connection and retry.' }}</p>
        <button @click="resetAndLoad">{{ $browser.i18n.getMessage('retry') || 'Retry' }}</button>
      </div>

      <!-- Matches list -->
      <div
        v-else-if="matches.length > 0"
        class="matches-list"
      >
        <MatchCard
          v-for="(match, index) in matches"
          :key="`match-list-${index}-${match.match_id}`"
          :match="match"
          :player-id="player.player_id"
          :highlighted="highlightedMatchIndex === index"
          @highlight-end="clearHighlight"
        />
      </div>

      <!-- Empty state -->
      <div
        v-else
        class="empty-matches"
      >
        <p>{{ $browser.i18n.getMessage('noMatchesFound') }}</p>
      </div>
    </div>

    <!-- Load more button -->
    <div
      v-if="matches.length > 0 && !isLoadingMatches && hasMore"
      class="load-more-section"
    >
      <button
        :disabled="loadingMore"
        class="load-more-btn"
        @click="loadMoreMatches"
      >
        <span v-if="loadingMore">{{ $browser.i18n.getMessage('loading') }}...</span>
        <span v-else>{{ $browser.i18n.getMessage('loadMoreMatches') }}</span>
      </button>
    </div>
    </template>
  </div>

  <!-- Состояния когда игрок не загружен -->
  
  <!-- Экран ошибки загрузки -->
  <LoadingError
    v-else-if="hasLoadingError"
    :title="$browser.i18n.getMessage('loadingErrorTitle') || 'Не удалось загрузить профиль'"
    :description="$browser.i18n.getMessage('loadingErrorDescription') || 'Проверьте подключение к интернету или попробуйте позже'"
    :retry-text="$browser.i18n.getMessage('retry') || 'Повторить'"
    :reset-text="$browser.i18n.getMessage('searchPlayer') || 'Поиск игрока'"
    @retry="$emit('retry-loading')"
    @reset="$emit('reset-to-search')"
  />

  <!-- Экран загрузки -->
  <LoadingState
    v-else-if="isLoading"
    :title="$browser.i18n.getMessage('loadingTitle') || 'Загрузка профиля...'"
    :description="$browser.i18n.getMessage('loadingDescription') || 'Получаем данные игрока с серверов Faceit'"
  />

  <!-- Empty State когда игрок не выбран -->
  <EmptyState v-else />
</template>

<script>
import RecentResults from './components/RecentResults.vue'
import MatchCard from './components/MatchCard.vue'
import EmptyState from './components/EmptyState.vue'
import LoadingState from './components/LoadingState.vue'
import LoadingError from './components/LoadingError.vue'
import { API_LIMITS } from '../../utils/constants.js'
import { getGameProfile } from '../../utils/gamePolicy.js'
import { faceitApi } from '../../services/faceitApi.js'
import { getMatchResult, getMatchResultLetter, findPlayerTeam } from '../../utils/matchUtils.js'
import { logCriticalError } from '../../services/sentry.js'

export default {
  components: {
    RecentResults,
    MatchCard,
    EmptyState,
    LoadingState,
    LoadingError
  },
  props: {
    player: {
      type: Object,
      default: () => ({})
    },
    fullStats: {
      type: Object,
      default: () => ({})
    },
    nickname: {
      type: String,
      default: null
    },
    selectedGame: {
      type: String,
      default: 'csgo'
    },
    isLoading: {
      type: Boolean,
      default: false
    },
    hasLoadingError: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      matches: [],
      requestId: 0,
      matchesError: false,
      loadingMatches: false,
      loadingMore: false,
      offset: 0,
      highlightedMatchIndex: null,
      currentPage: 0,
      hasMore: true
    }
  },
  computed: {
    gameProfile () { return getGameProfile(this.player, this.selectedGame) },
    recentResults () {
      return this.fullStats?.lifetime?.['Recent Results'] || []
    },
    recentMatches () {
      return this.matches.slice(0, 5)
    },
    isLoadingMatches () {
      return this.loadingMatches
    }
  },
  watch: {
    'player.player_id': async function (newPlayerId) {
      if (newPlayerId) {
        this.resetAndLoad()
      }
    },
    selectedGame: async function () {
      if (this.player?.player_id) {
        this.resetAndLoad()
      }
    },
    '$route.query.highlight': function () {
      // Применяем подсветку при изменении query параметра
      if (this.matches.length > 0) {
        this.handleHighlightFromQuery()
      }
    }
  },
  beforeDestroy () {
    this.requestId++
  },
  async mounted () {
    // Отслеживаем просмотр истории матчей
    this.$analytics.trackEvent('match_history_loaded', {
      player_id: this.player?.player_id || 'unknown',
      nickname: this.player?.nickname || 'unknown',
      selected_game: this.selectedGame
    })

    this.resetAndLoad()
    this.handleHighlightFromQuery()
  },
  methods: {
    async loadMatches () {
      if (this.loadingMatches || !this.hasMore || !this.player?.player_id) return
      if (this.selectedGame === 'ow2' && !this.gameProfile) return
      const requestId = this.requestId
      const playerId = this.player.player_id
      const game = this.selectedGame
      const isCurrent = () => requestId === this.requestId && playerId === this.player?.player_id && game === this.selectedGame
      this.loadingMatches = true
      this.matchesError = false
      try {
        const response = await faceitApi.getPlayerMatches(playerId, game, this.offset, API_LIMITS.MATCHES_PER_PAGE)
        if (!isCurrent()) return
        const newMatches = response.items || []
        const existingIds = new Set(this.matches.map(match => match.match_id))
        this.matches.push(...newMatches.filter(match => !existingIds.has(match.match_id)))
        this.offset += newMatches.length
        this.currentPage++
        this.hasMore = newMatches.length === API_LIMITS.MATCHES_PER_PAGE
        this.$analytics.trackEvent('match_history_loaded', { player_id: playerId, selected_game: game, matches_count: newMatches.length })
      } catch (error) {
        if (!isCurrent()) return
        this.matchesError = true
        this.hasMore = false
        logCriticalError(error, { context: 'match_history_loading', player_id: playerId, selectedGame: game })
      } finally {
        if (isCurrent()) this.loadingMatches = false
      }
    },
    async resetAndLoad () {
      this.requestId++
      this.matches = []
      this.offset = 0
      this.currentPage = 0
      this.hasMore = true
      this.matchesError = false
      this.loadingMatches = false
      await this.loadMatches()
      this.handleHighlightFromQuery()
    },
    getMatchResult (match) {
      return getMatchResult(match, this.player.player_id)
    },
    getMatchResultText (match) {
      const result = this.getMatchResult(match)
      if (result === 'win') return this.$browser.i18n.getMessage('win') || 'Win'
      if (result === 'loss') return this.$browser.i18n.getMessage('loss') || 'Loss'
      return 'N/A'
    },
    getMatchResultLetter (match) {
      return getMatchResultLetter(match, this.player.player_id)
    },
    goToSpecificMatch (index) {
      // Отслеживаем открытие конкретного матча
      const match = this.matches[index]
      this.$analytics.trackEvent('specific_match_opened', {
        match_id: match?.match_id || 'unknown',
        match_index: index,
        player_id: this.player.player_id,
        nickname: this.player.nickname,
        match_result: this.getMatchResult(match)
      })

      this.highlightedMatchIndex = index

      // Убираем подсветку через 3 секунды
      setTimeout(() => {
        this.highlightedMatchIndex = null
      }, 3000)

      // Прокручиваем к выделенному матчу
      this.$nextTick(() => {
        const matchCards = document.querySelectorAll('.match-card')
        if (matchCards[index]) {
          matchCards[index].scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          })
        }
      })
    },
    findPlayerTeam (match) {
      return findPlayerTeam(match, this.player.player_id)
    },
    clearHighlight () {
      this.highlightedMatchIndex = null
    },
    async loadMoreMatches () {
      await this.loadMatches()
    },
    handleHighlightFromQuery () {
      // Проверяем есть ли параметр для подсветки матча
      if (this.$route.query.highlight !== undefined) {
        const highlightIndex = parseInt(this.$route.query.highlight)

        if (!isNaN(highlightIndex) && highlightIndex >= 0 && highlightIndex < this.matches.length) {
          this.highlightedMatchIndex = highlightIndex

          // Убираем подсветку через 3 секунды
          setTimeout(() => {
            this.highlightedMatchIndex = null
          }, 3000)

          // Прокручиваем к выделенному матчу с дополнительной задержкой для рендеринга
          this.$nextTick(() => {
            setTimeout(() => {
              const matchesContainer = document.querySelector('.matches-list')
              if (matchesContainer) {
                const matchCards = matchesContainer.children
                if (matchCards[highlightIndex]) {
                  matchCards[highlightIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                  })
                }
              }
            }, 100) // Небольшая задержка для гарантированного рендеринга
          })
        }
      }
    }
  },
  emits: ['retry-loading', 'reset-to-search']
}
</script>

<style lang="scss" scoped>
.player-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.player-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px solid #f50;
}

.player-details {
  h2 {
    margin: 0;
    color: #f50;
    font-size: 1.5rem;
  }
}

.country-flag {
  margin-left: 10px;
  vertical-align: middle;
}

.results-summary {
  background: rgba(0, 0, 0, 0.8);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid rgba(245, 85, 0, 0.3);

  h3 {
    margin: 0 0 15px 0;
    color: #f50;
    font-size: 1.3rem;
  }
}

.recent-wl-circles {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 15px;
}

.wl-circle {
  width: 35px;
  height: 35px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  cursor: pointer;
  border: 2px solid transparent;

  &.win {
    background: linear-gradient(135deg, #4caf50, #45a049);
    color: white;
    border-color: #4caf50;
  }

  &.loss {
    background: linear-gradient(135deg, #f44336, #d32f2f);
    color: white;
    border-color: #f44336;
  }

  &.unknown {
    background: linear-gradient(135deg, #666, #555);
    color: white;
    border-color: #666;
  }

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
}

.match-history {
  background: rgba(0, 0, 0, 0.8);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid rgba(245, 85, 0, 0.3);

  h3 {
    margin: 0 0 20px 0;
    color: #f50;
    font-size: 1.3rem;
  }
}

.loading-state {
  text-align: center;
  padding: 40px 20px;
  color: #ccc;

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(245, 85, 0, 0.3);
    border-radius: 50%;
    border-top-color: #f50;
    animation: spin 1s ease-in-out infinite;
    margin: 0 auto 15px;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.matches-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.empty-matches {
  text-align: center;
  padding: 40px 20px;
  color: #ccc;
}

.load-more-section {
  text-align: center;
  margin-top: 20px;
}

.load-more-btn {
  background: linear-gradient(135deg, #f50 0%, #e64d00 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(245, 85, 0, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
</style>
