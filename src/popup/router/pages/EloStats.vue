<template>
  <div
    v-if="player"
    class="elo-stats-wrapper"
  >
    <div class="player-header">
      <!-- Кнопка избранного слева -->
      <div class="favorite-container">
        <FavoriteButton
          :player="player"
          :selected-game="selectedGame"
        />
      </div>

      <!-- Ссылка на профиль по центру -->
      <div class="profile-link-container">
        <a
          href="#"
          @click="openProfile"
        >
          {{ $browser.i18n.getMessage('goToProfile') }}

          <b>{{ nickname }}</b>

          <img
            :src="`https://flagsapi.com/${player.country.toUpperCase()}/flat/16.png`"
            alt="flag"
            class="country-flag"
          >
        </a>
      </div>

      <!-- Пустой блок справа для баланса -->
      <div class="right-spacer" />
    </div>
    <!--
    <img
      v-if="player.avatar"
      :src="player.avatar"
      alt="Avatar"
      style="width: 100%;"
    >-->
    <!--
    <div style="display: flex; justify-content: center;">
      <div
        v-for="(result, i) in fullStats.lifetime['Recent Results']"
        :key="'last-result-' + i"
      >
        <span :class="(+result ? 'win-result' : 'lose-result') + '  result'">
          {{ +result ? 'W' : 'L' }}
        </span>
      </div>
    </div>-->

    <div
      v-if="csgoStats && csgoStats.skill_level"
      class="stats-container"
    >
      <p class="level-info">
        {{ $browser.i18n.getMessage('level') }}
        <img
          :src="$browser.runtime.getURL(`assets/skill_level_${csgoStats.skill_level}_svg.svg`)"
          alt="lvl icon"
          class="level-icon"
        >
      </p>
      <p>
        {{ $browser.i18n.getMessage('elo') }}
        <b class="value">{{ csgoStats.faceit_elo }}</b>.
      </p>

      <p>
        {{ $browser.i18n.getMessage('eloRangeFor', csgoStats.skill_level) }}
        <b class="value">{{ currentLvl.range[0] }} - {{ currentLvl.range[1] === maxElo ? '∞' : currentLvl.range[1] }}</b>.
      </p>

      <!-- Progress -->
      <template v-if="csgoStats.skill_level < 10">
        <div
          :data-label="progressLabel"
          class="progress"
        >
          <span
            class="progress-value"
            :style="`width: ${progressPercentage}%; background-color: ${progressBarColor};`"
          />
        </div>
      </template>

      <p>
        <span v-if="csgoStats.skill_level < 10">
          {{ $browser.i18n.getMessage('playerCanRaiseLvlIfHeGets') }}
          <b class="value">{{ lvls[currentLvlIndex + 1].range[0] - csgoStats.faceit_elo }}</b> elo.
        </span>
        <span v-else>
          {{ $browser.i18n.getMessage('playerHas') }}
          <b class="value">{{ $browser.i18n.getMessage('maximalLvl') }}</b>.
        </span>
      </p>

      <p>
        <span v-if="csgoStats.skill_level > 1">
          {{ $browser.i18n.getMessage('playerMayLoseLvlIfHeLoses') }}
          <b class="value">{{ csgoStats.faceit_elo - lvls[currentLvlIndex - 1].range[1] }}</b> elo.
        </span>
        <span v-else>
          {{ $browser.i18n.getMessage('playerHas') }}
          <b class="value">{{ $browser.i18n.getMessage('minimalLvl') }}</b>.
        </span>
      </p>

      <!-- <div>
        <RecentResults
          :results="fullStats.lifetime['Recent Results']"
          @go-to-match="goToSpecificMatch"
        />
      </div>
       -->
      <!-- W/L кружки для последних матчей -->
      <div v-if="lastMatches.length > 0">
        <h4 class="recent-matches-title">{{ $browser.i18n.getMessage('recentResults') || 'Recent Matches' }}</h4>
        <div class="recent-wl-circles">
          <div
            v-for="(match, index) in lastMatches"
            :key="'elo-stats-last-match-' + match.match_id"
            :class="['wl-circle', getMatchResult(match)]"
            :title="getMatchTooltip(match)"
            @click="goToSpecificMatch(index)"
          >
            {{ getMatchResultLetter(match) }}
          </div>
        </div>
      </div>
    </div>

    <div class="save-profile-section">
      <label class="save-profile-checkbox">
        <input
          type="checkbox"
          :checked="localStorageNickname === nickname"
          @change="toggleSaveProfile"
        >
        <span class="checkmark" />
        <span class="checkbox-label">
          {{ $browser.i18n.getMessage('showThisProfileAfterOpening') }}
        </span>
      </label>
    </div>
  </div>

  <!-- Состояния когда игрок не загружен -->
  
  <!-- Экран ошибки загрузки -->
  <LoadingError
    v-else-if="hasLoadingError"
    :title="$browser.i18n.getMessage('loadingErrorTitle') || 'Не удалось загрузить профиль'"
    :description="$browser.i18n.getMessage('loadingErrorDescription') || 'Проверьте подключение к интернету или попробуйте позже'"
    :image-src="selectedGame === 'cs2' ? 'https://assets.faceit-cdn.net/third_party/games/ea5c4171-712f-4afd-a8ae-3fb5e1e2afb8.jpeg?width=48&height=48' : 'https://assets.faceit-cdn.net/third_party/games/4f899245-2fa8-4e52-ad9a-4a363613c19e/assets/details/csgo_flag_s_1589795160776.jpg'"
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
import EmptyState from './components/EmptyState.vue'
import FavoriteButton from './components/FavoriteButton.vue'
import LoadingState from './components/LoadingState.vue'
import LoadingError from './components/LoadingError.vue'
import { faceitApi } from '../../services/faceitApi.js'
import { getMatchResult, getMatchResultClass } from '../../utils/matchUtils.js'
import { logCriticalError, logWarning, logUserAction, setSentryUser, clearSentryUser } from '../../services/sentry.js'

export default {
  components: {
    EmptyState,
    FavoriteButton,
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
    localStorageNickname: {
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
    const maxElo = 9999

    return {
      maxElo,
      matches: [],
      // Диапазоны для CS:GO (исторические)
      lvlsCsgo: [
        { range: [1, 800], label: '1' },
        { range: [801, 950], label: '2' },
        { range: [951, 1100], label: '3' },
        { range: [1101, 1250], label: '4' },
        { range: [1251, 1400], label: '5' },
        { range: [1401, 1550], label: '6' },
        { range: [1551, 1700], label: '7' },
        { range: [1701, 1850], label: '8' },
        { range: [1851, 2000], label: '9' },
        { range: [2001, maxElo], label: '10' }
      ],
      // Диапазоны для CS2 (по заданию)
      lvlsCs2: [
        { range: [100, 500], label: '1' },
        { range: [501, 750], label: '2' },
        { range: [751, 900], label: '3' },
        { range: [901, 1050], label: '4' },
        { range: [1051, 1200], label: '5' },
        { range: [1201, 1350], label: '6' },
        { range: [1351, 1530], label: '7' },
        { range: [1531, 1750], label: '8' },
        { range: [1751, 2000], label: '9' },
        { range: [2001, maxElo], label: '10' }
      ]
    }
  },
  computed: {
    // Выбор корректных диапазонов уровней по выбранной игре
    lvls () {
      return this.selectedGame === 'cs2' ? this.lvlsCs2 : this.lvlsCsgo
    },
    progressLabel () {
      // Для максимального уровня показываем текущее ELO
      if (this.csgoStats.skill_level >= 10) {
        return `${this.csgoStats.faceit_elo} (Max lvl)`
      }
      // return `${this.csgoStats.faceit_elo} / ${this.currentLvlNextLvlStart} (${Math.floor(this.csgoStats.faceit_elo / this.currentLvlNextLvlStart * 100)} %)`
      return `${this.csgoStats.faceit_elo} - ${this.currentLvlNextLvlStart} (${this.progressPercentage} %)`
    },
    progressPercentage () {
      // Для максимального уровня прогресс всегда 100%
      if (this.csgoStats.skill_level >= 10) {
        return 100
      }

      // Возвращает прогресс в процентах от текущего уровня до следующего
      const start = this.lvls[this.currentLvlIndex].range[0]
      const nextStart = this.currentLvlNextLvlStart
      const denom = nextStart - start
      if (denom <= 0) return 100
      const raw = ((this.csgoStats.faceit_elo - start) / denom) * 100
      return Math.max(0, Math.min(100, Math.floor(raw)))
      // return Math.floor(this.csgoStats.faceit_elo / this.currentLvlNextLvlStart * 100)
    },
    profileUrl () {
      return this.player.faceit_url.replace(/{lang}/, 'en')
    },
    csgoStats () {
      // Защита: если выбранной игры нет в профиле, используем любую доступную
      const games = this.player?.games || {}
      return games[this.selectedGame] || games.csgo || games.cs2 || {}
    },
    currentLvl () {
      // Faceit может иметь 0 elo. Не провоцируем UI-ошибку при несовпадении elo/level,
      // так как для CS2 пороги уровней отличаются и часто не совпадают с elo.
      const elo = Math.max(this.csgoStats.faceit_elo, 1)
      const skillLevelLabel = this.csgoStats.skill_level?.toString()

      const rangeByElo = this.lvls.find(i => i.range[0] <= elo && elo <= i.range[1])
      const rangeByLabel = this.lvls.find(i => i.label === skillLevelLabel)

      if (rangeByLabel && rangeByElo && rangeByLabel.label !== rangeByElo.label) {
        // Логируем предупреждение, но не ломаем UI
        logWarning('ELO/level mismatch detected', {
          player_id: this.player.player_id,
          nickname: this.nickname,
          elo,
          skill_level: this.csgoStats.skill_level,
          selectedGame: this.selectedGame
        })
      }

      // Приоритет: то, что пришло из API (label), далее — вычисление по elo, иначе — первый уровень.
      return rangeByLabel || rangeByElo || this.lvls[0]
    },
    currentLvlIndex () {
      const lvl = this.currentLvl
      if (!lvl) return 0 // Защита от undefined
      return this.lvls.indexOf(lvl)
    },
    currentLvlNextLvlStart () {
      // Если это максимальный уровень (10), возвращаем текущее ELO (не используется в UI)
      if (this.currentLvlIndex >= this.lvls.length - 1) {
        return this.csgoStats.faceit_elo
      }
      return this.lvls[this.currentLvlIndex + 1].range[0]
    },
    lastMatches () {
      return this.matches.slice(0, 5)
    },
    // Динамический цвет прогресс-бара
    progressBarColor () {
      const progress = this.progressPercentage
      
      if (progress <= 30) {
        // Красный для низкого прогресса (0-30%)
        return '#f44336'
      } else if (progress <= 70) {
        // Переход от красного к желтому/оранжевому (30-70%)
        const ratio = (progress - 30) / 40 // 0-1
        return `hsl(${20 * ratio}, 80%, 50%)` // От красного (0°) к оранжевому (20°)
      } else {
        // Переход от оранжевого к зеленому (70-100%)
        const ratio = (progress - 70) / 30 // 0-1
        return `hsl(${20 + 100 * ratio}, 70%, 45%)` // От оранжевого (20°) к зеленому (120°)
      }
    }
  },
  watch: {
    player: {
      handler (newPlayer, oldPlayer) {
        // eslint-disable-next-line camelcase
        if (newPlayer?.player_id && newPlayer.player_id !== oldPlayer?.player_id) {
          // Отслеживаем загрузку профиля игрока
          this.$analytics.trackEvent('player_profile_loaded', {
            player_id: newPlayer.player_id,
            nickname: newPlayer.nickname,
            skill_level: newPlayer.games?.csgo?.skill_level || 'unknown',
            elo: newPlayer.games?.csgo?.faceit_elo || 0,
            country: newPlayer.country
          })
          
          this.loadLastMatches()
        }
      },
      immediate: true
    },
    selectedGame: {
      handler (newGame, oldGame) {
        // eslint-disable-next-line camelcase
        if (newGame !== oldGame && this.player?.player_id) {
          this.loadLastMatches()
        }
      }
    }
  },
  async created () {
    // eslint-disable-next-line camelcase
    if (this.player?.player_id) {
      await this.loadLastMatches()
      
      // Отслеживаем время загрузки данных
      const startTime = performance.now()
      setTimeout(() => {
        const loadTime = performance.now() - startTime
        this.$analytics.trackTiming('data_load_time', Math.round(loadTime))
      }, 100)
    }
  },
  methods: {
    openProfile () {
      // Отслеживаем переход на профиль Faceit
      this.$analytics.trackEvent('faceit_profile_opened', {
        player_id: this.player.player_id,
        nickname: this.nickname,
        profile_url: this.profileUrl
      })
      
      this.$browser.tabs.create({
        url: this.profileUrl
      })
    },
    toggleSaveProfile () {
      const newNickname = this.localStorageNickname === this.nickname ? null : this.nickname
      
      // Отслеживаем включение/отключение автозагрузки профиля
      this.$analytics.trackEvent(
        newNickname ? 'profile_auto_load_enabled' : 'profile_auto_load_disabled',
        {
          nickname: this.nickname,
          player_id: this.player.player_id
        }
      )
      
      // Логируем действие пользователя
      logUserAction('toggle_save_profile', {
        nickname: this.nickname,
        action: newNickname ? 'save' : 'unsave'
      })
      
      // Обновляем пользователя в Sentry
      if (newNickname) {
        setSentryUser(newNickname)
      } else {
        clearSentryUser()
      }
      
      this.$emit('set-local-storage-nickname', newNickname)
    },
    goToSpecificMatch (matchIndex) {
      // Отслеживаем клик по результату матча
      this.$analytics.trackEvent('match_result_clicked', {
        match_index: matchIndex,
        player_id: this.player.player_id,
        nickname: this.nickname
      })
      
      logUserAction('navigate_to_match_history', {
        matchIndex,
        nickname: this.nickname
      })
      
      // Переходим на страницу истории матчей с подсветкой конкретного матча
      this.$router.push({
        name: 'match-history',
        query: { highlight: matchIndex }
      })
    },
    async loadLastMatches () {
      const startTime = performance.now()
      
      try {
        // eslint-disable-next-line camelcase
        const { items } = await faceitApi.getRecentMatches(this.player.player_id, this.selectedGame)
        this.matches = items || []
        
        // Отслеживаем успешную загрузку матчей
        const loadTime = performance.now() - startTime
        this.$analytics.trackTiming('api_response_time', Math.round(loadTime))
        
      } catch (error) {
        console.error('Error loading last matches:', error)
        
        // Отслеживаем ошибку загрузки данных
        this.$analytics.trackError(`Data load failed: ${error.message}`, false)
        this.$analytics.trackEvent('data_load_failed', {
          error_type: 'recent_matches',
          player_id: this.player.player_id,
          error_message: error.message
        })
        
        // Логируем ошибку загрузки матчей
        logWarning('Failed to load recent matches', {
          player_id: this.player.player_id,
          selectedGame: this.selectedGame,
          error: error.message
        })
        
        this.matches = []
      }
    },
    getMatchResult (match) {
      // eslint-disable-next-line camelcase
      return getMatchResult(match, this.player.player_id)
    },
    getMatchResultClass (match) {
      // eslint-disable-next-line camelcase
      return getMatchResultClass(match, this.player.player_id)
    },
    getMatchResultText (match) {
      const result = this.getMatchResult(match)
      if (result === 'win') return this.$browser.i18n.getMessage('win')
      if (result === 'loss') return this.$browser.i18n.getMessage('loss')
      return 'N/A'
    },
    getMatchResultLetter (match) {
      const result = this.getMatchResult(match)
      if (result === 'win') return 'W'
      if (result === 'loss') return 'L'
      return 'N/A'
    },
    formatCreatedAt (createdAt) {
      const date = new Date(createdAt * 1000)
      return date.toLocaleDateString()
    },
    formatElo (elo) {
      if (!elo || elo === 'undefined') return 'N/A'
      return elo
    },
    getSkinColorByElo (elo) {
      if (!elo || elo === 'undefined') return 'color: white;'
      if (elo <= 800) return 'color: #5E5E5E;'
      if (elo <= 950) return 'color: #69BD56;'
      if (elo <= 1100) return 'color: #69BD56;'
      if (elo <= 1250) return 'color: #FFC537;'
      if (elo <= 1400) return 'color: #FFC537;'
      if (elo <= 1550) return 'color: #FF9D2B;'
      if (elo <= 1700) return 'color: #FF6309;'
      if (elo <= 1850) return 'color: #FF6309;'
      if (elo <= 2000) return 'color: #FF2828;'
      return 'color: #FF2828;'
    },
    formatAvgKd (kd) {
      if (!kd || kd === 'undefined') return 'N/A'
      return parseFloat(kd).toFixed(2)
    },
    formatAvgHs (hs) {
      if (!hs || hs === 'undefined') return 'N/A'
      return Math.round(parseFloat(hs)) + '%'
    },
    formatWinRate (matches, wins) {
      if (!matches || !wins || matches === 'undefined' || wins === 'undefined') return 'N/A'
      return Math.round((parseInt(wins) / parseInt(matches)) * 100) + '%'
    },
    formatKdStyle (kd) {
      if (!kd || kd === 'undefined') return 'color: white;'
      const parsedKd = parseFloat(kd)
      if (parsedKd >= 1.3) return 'color: #4CAF50;'
      if (parsedKd >= 1.0) return 'color: #FFC107;'
      return 'color: #F44336;'
    },
    formatHsStyle (hs) {
      if (!hs || hs === 'undefined') return 'color: white;'
      const parsedHs = parseFloat(hs)
      if (parsedHs >= 50) return 'color: #4CAF50;'
      if (parsedHs >= 40) return 'color: #FFC107;'
      return 'color: #F44336;'
    },
    formatWinRateStyle (matches, wins) {
      if (!matches || !wins || matches === 'undefined' || wins === 'undefined') return 'color: white;'
      const winRate = (parseInt(wins) / parseInt(matches)) * 100
      if (winRate >= 60) return 'color: #4CAF50;'
      if (winRate >= 50) return 'color: #FFC107;'
      return 'color: #F44336;'
    },
    getSkillLevelInfo (elo) {
      if (!elo || elo === 'undefined') return null
      const skillLevels = this.skillLevels
      for (const level of skillLevels) {
        if (elo >= level.range[0] && elo <= level.range[1]) {
          return level
        }
      }
      return null
    },
    getMatchTooltip (match) {
      const result = this.getMatchResult(match)
      const resultText = result === 'win' ? 'Победа' : result === 'loss' ? 'Поражение' : 'N/A'
      const date = new Date(match.created_at * 1000).toLocaleDateString()
      
      let tooltip = `${resultText} • ${date}`
      
      // Добавляем информацию о карте если доступна
      if (match.voting && match.voting.map && match.voting.map.pick && match.voting.map.pick[0]) {
        tooltip += ` • ${match.voting.map.pick[0]}`
      }
      
      // Добавляем счет если доступен
      if (match.results && match.results.score) {
        const scores = Object.values(match.results.score)
        if (scores.length === 2) {
          tooltip += ` • ${scores[0]}:${scores[1]}`
        }
      }
      
      tooltip += ' • Клик для просмотра в истории матчей'
      
      return tooltip
    }
  },
  emits: ['profile-error', 'set-local-storage-nickname', 'retry-loading', 'reset-to-search']
}
</script>

<style scoped>
  .elo-stats-wrapper {
    background: rgba(0, 0, 0, 0.8);
    padding: 10px;
    border-radius: 8px;
    border: 1px solid rgba(245, 85, 0, 0.3);
    color: white;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  }

  .player-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    position: relative;
  }

  .favorite-container {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }

  .profile-link-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
  }

  .right-spacer {
    flex: 0 0 auto;
    width: 40px; /* Примерно ширина кнопки избранного для баланса */
  }

  .country-flag {
    vertical-align: middle;
  }

  .stats-container {
    padding: 0 5px;
  }

  .level-info {
    display: flex;
    align-items: center;
  }

  .level-icon {
    width: 32px;
    margin-left: 6px;
  }

  .save-profile-section {
    text-align: center;
    margin-top: 10px;
  }

  .value {
    color: #f50;
    font-weight: bold;
  }

  .win-result {
    color: #5dbb29 !important;
  }

  .lose-result {
    color: #d64242 !important;
  }

  .result {
    font-size: 18px;
    font-weight: 700;
    margin: 2px;
  }

  /* Progress-bar */
  .progress {
    height: 2.8em;
    width: 100%;
    background-color: #c9c9c9;
    position: relative;
  }
  .progress:before {
    content: attr(data-label);
    font-size: 1.5em;
    position: absolute;
    text-align: center;
    top: 5px;
    left: 0;
    right: 0;
  }
  .progress .progress-value {
    background-color: #7cc4ff;
    display: inline-block;
    height: 100%;
    transition: background-color 0.3s ease, width 0.3s ease;
  }

  .save-profile-checkbox {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    font-size: 14px;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }

  .save-profile-checkbox input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }

  .checkmark {
    height: 20px;
    width: 20px;
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    transition: all 0.3s ease;
    flex-shrink: 0;
  }

  .save-profile-checkbox:hover input ~ .checkmark {
    background-color: rgba(245, 85, 0, 0.2);
    border-color: rgba(245, 85, 0, 0.6);
  }

  .save-profile-checkbox input:checked ~ .checkmark {
    background-color: #f50;
    border-color: #f50;
  }

  .checkmark:after {
    content: "";
    position: absolute;
    display: none;
  }

  .save-profile-checkbox input:checked ~ .checkmark:after {
    display: block;
  }

  .save-profile-checkbox .checkmark:after {
    left: 6px;
    top: 3px;
    width: 4px;
    height: 8px;
    border: solid white;
    border-width: 0 2px 2px 0;
    -webkit-transform: rotate(45deg);
    -ms-transform: rotate(45deg);
    transform: rotate(45deg);
  }

  .checkbox-label {
    margin-left: 8px;
    color: rgba(255, 255, 255, 0.9);
  }

  .recent-wl-circles {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 15px;
  }

  .wl-circle {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 0.8rem;
    transition: all 0.3s ease;
    cursor: pointer;
    border: 2px solid transparent;
  }

  .wl-circle.win {
    background: linear-gradient(135deg, #4caf50, #45a049);
    color: white;
    border-color: #4caf50;
  }

  .wl-circle.loss {
    background: linear-gradient(135deg, #f44336, #d32f2f);
    color: white;
    border-color: #f44336;
  }

  .wl-circle.unknown {
    background: linear-gradient(135deg, #666, #555);
    color: white;
    border-color: #666;
  }

  .wl-circle:hover {
    transform: scale(1.15);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
    z-index: 10;
    position: relative;
  }

  .wl-circle:active {
    transform: scale(1.05);
  }

  .recent-matches-title {
    text-align: center;
    margin: 15px 0 10px 0;
    color: #f50;
    font-size: 1.1rem;
    font-weight: 600;
  }
</style>

<!--
{
  "player_id": "aeb518be-075e-4a8e-9ab4-070c270c4e30",
  "nickname": "Kicker_IZ",
  "avatar": "https://d50m6q67g4bn3.cloudfront.net/avatars/aeb518be-075e-4a8e-9ab4-070c270c4e30_1478454446779",
  "country": "ua",
  "cover_image": "",
  "cover_featured_image": "",
  "infractions": {
    "last_infraction_date": "Thu Jan 25 02:07:29 UTC 2018",
    "afk": 0,
    "leaver": 0,
    "qm_not_checkedin": 1,
    "qm_not_voted": 0
  },
  "platforms": {
    "steam": "STEAM_1:0:132106954"
  },
  "games": {
    "csgo": {
      "game_profile_id": "5c6b863f-3b7a-4925-9f2e-d3d4971a320d",
      "region": "EU",
      "regions": {
        "EU": {
          "selected_ladder_id": "24e6d014-7613-428a-8600-fedfee6dc718"
        }
      },
      "skill_level": "10",
      "game_player_id": "76561198224479636",
      "skill_level": 10,
      "faceit_elo": 2130,
      "game_player_name": "koala"
    }
  },
  "settings": {
    "language": "ru"
  },
  "friends_ids": [
    "b0366396-e719-4e44-8124-d73a3f255add"
  ],
  "bans": [],
  "new_steam_id": "[U:1:264213908]",
  "steam_id_64": "76561198224479636",
  "steam_nickname": "Kicker",
  "membership_type": "free",
  "memberships": [
    "free"
  ],
  "faceit_url": "https://www.faceit.com/{lang}/players/Kicker_IZ"
}-->
