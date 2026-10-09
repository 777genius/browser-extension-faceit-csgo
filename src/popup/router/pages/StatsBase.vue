<template>
  <div class="stats-base">
    <div
      id="background"
      :style="{
        'background-image': backgroundImage
      }"
    />

    <!-- Рекламный баннер -->
    <AdvertisementBanner />

    <div class="content">
      <!-- Хедер с элементами управления -->
      <AppHeader :selected-game="selectedGame" @game-selected="onGameSelected" />

      <!-- Поле ввода игрока (скрывается на странице "Избранные игроки") -->
      <PlayerSearch
        v-if="$route.name !== 'favorites'"
        ref="playerSearch"
        :selected-game="selectedGame"
        :initial-nickname="nickname"
        @player-found="onPlayerFound"
        @player-loading="onPlayerLoading"
        @player-error="onProfileError"
      />

      <!-- Табы (скрываются на странице "Избранные игроки") -->
      <AnimatedTabs
        v-if="player && $route.name !== 'favorites'"
        :tabs="tabs"
      />

      <!-- VIEW -->
      <OverwatchStats
        v-if="selectedGame === 'ow2' && !['match-history', 'favorites'].includes($route.name)"
        :player="player"
        :nickname="nickname"
        :full-stats="fullStats"
        :local-storage-nickname="localStorageNickname"
        :is-loading="isLoadingProfile"
        :has-loading-error="hasLoadingError"
        :stats-error="statsError"
        @set-local-storage-nickname="setLocalStorageNickname"
        @retry-loading="retryLoading"
        @reset-to-search="resetToSearch"
      />
      <router-view
        v-else
        :key="selectedGame + ':' + (player ? player.player_id : '')"
        :player="player"
        :nickname="nickname"
        :full-stats="fullStats"
        :local-storage-nickname="localStorageNickname"
        :selected-game="selectedGame"
        :is-loading="isLoadingProfile"
        :has-loading-error="hasLoadingError"
        @profile-error="onProfileError"
        @set-local-storage-nickname="setLocalStorageNickname"
        @retry-loading="retryLoading"
        @reset-to-search="resetToSearch"
      />

    </div>

    <!-- Рекламный баннер внизу -->
    <AdvertisementBanner suffix="_2" />
  </div>
</template>

<script>
import AnimatedTabs from './components/AnimatedTabs.vue'
import AppHeader from './components/AppHeader.vue'
import PlayerSearch from './components/PlayerSearch.vue'
import { normalizeGame } from '../../utils/gamePolicy.js'
import OverwatchStats from './OverwatchStats.vue'
import AdvertisementBanner from './components/AdvertisementBanner.vue'

export default {
  components: {
    OverwatchStats,
    AnimatedTabs,
    AppHeader,
    PlayerSearch,
    AdvertisementBanner
  },
  data () {
    const storageNickname = localStorage.getItem('nickname')
    // Проверяем что значение не равно строке 'null' или null
    const validNickname = storageNickname && storageNickname !== 'null' ? storageNickname : null

    return {
      nickname: validNickname,
      player: null,
      fullStats: null,
      defaultAvatar: 'https://cdn-frontend.faceit.com/web/54-1542827848/static/media/avatar_default_user_300x300.8befe042.jpg',
      localStorageNicknameData: validNickname,
      selectedGame: normalizeGame(localStorage.getItem('selectedGame')),
      statsError: false,
      isLoadingProfile: false,
      hasLoadingError: false,
      loadingTimeoutId: null,
      profileNeedsReload: !!validNickname,
      profileLoadTimer: null
    }
  },
  computed: {
    localStorageNickname: {
      get () {
        return this.localStorageNicknameData
      },
      set (nickname) {
        this.localStorageNicknameData = nickname

        if (nickname === null) {
          localStorage.removeItem('nickname')
        } else {
          localStorage.setItem('nickname', nickname)
        }
      }
    },
    backgroundImage () {
      const avatar =
        (
          this.player &&
          this.player.avatar
        )
          ? this.avatarOrDefault(this.player.avatar)
          : this.defaultAvatar

      return `url(${avatar})`
    },
    tabs () {
      return [
        {
          name: 'index',
          to: { name: 'index' },
          icon: 'fas fa-chart-line'
        },
        {
          name: 'full-stats',
          to: { name: 'full-stats' },
          icon: 'fas fa-chart-bar'
        },
        {
          name: 'match-history',
          to: { name: 'match-history' },
          icon: 'fas fa-history'
        }
      ]
    }
  },
  watch: {
    '$route.name' (route, previousRoute) {
      if (route === 'favorites') {
        this.cancelQueuedProfileLoad()
        if (this.isLoadingProfile) this.profileNeedsReload = true
        this.$refs.playerSearch?.cancelRequests()
        this.clearLoadingState()
      } else if (previousRoute === 'favorites' && this.profileNeedsReload) {
        this.scheduleProfileLoad()
      }
    }
  },
  created () {
    if (this.nickname) this.scheduleProfileLoad()

    // Слушаем событие поиска игрока из списка избранных
    this.$root.$on('search-player', this.searchPlayerFromFavorites)
  },
  beforeDestroy () {
    this.cancelQueuedProfileLoad()
    // Убираем слушатель при уничтожении компонента
    this.$root.$off('search-player', this.searchPlayerFromFavorites)
    
    // Очищаем таймаут загрузки
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId)
    }
  },
  methods: {
    cancelQueuedProfileLoad () {
      clearTimeout(this.profileLoadTimer)
      this.profileLoadTimer = null
    },
    scheduleProfileLoad () {
      this.cancelQueuedProfileLoad()
      if (!this.nickname || this.$route.name === 'favorites') return
      // The next event-loop turn lets PlayerSearch remount and gives an explicit
      // favorite selection priority over resuming the previous nickname.
      this.profileLoadTimer = setTimeout(() => {
        this.profileLoadTimer = null
        if (this.$route.name !== 'favorites' && this.profileNeedsReload && this.nickname) {
          this.$refs.playerSearch?.findPlayer({ nickname: this.nickname })
        }
      }, 0)
    },
    setLocalStorageNickname (val) {
      this.localStorageNickname = val
    },
    onGameSelected (game, reload = true) {
      game = normalizeGame(game)
      if (this.selectedGame === game) return
      this.selectedGame = game
      localStorage.setItem('selectedGame', game)
      this.cancelQueuedProfileLoad()
      this.profileNeedsReload = !!this.nickname
      this.player = null
      this.fullStats = null
      this.statsError = false
      this.$refs.playerSearch?.cancelRequests()
      if (this.$route.name === 'map-stats') this.$router.replace({ name: 'full-stats' })
      if (reload) this.scheduleProfileLoad()
    },
    onPlayerLoading ({ nickname, game }) {
      if (game !== this.selectedGame) return
      this.cancelQueuedProfileLoad()
      this.profileNeedsReload = true
      this.nickname = nickname
      this.player = null
      this.fullStats = null
      this.statsError = false
      this.startLoading()
    },
    onPlayerFound ({ player, fullStats, nickname, game, statsError }) {
      if (game !== this.selectedGame) return
      this.clearLoadingState()
      this.profileNeedsReload = false
      this.player = player
      this.fullStats = fullStats
      this.nickname = nickname
      this.statsError = !!statsError
      // Preserve the existing Counter-Strike migration fallback, with a refetch
      // so profile, selected label and statistics all describe the same game.
      const games = (player && player.games) || {}
      if (game !== 'ow2' && !games[game]) {
        const fallback = games.csgo ? 'csgo' : games.cs2 ? 'cs2' : null
        if (fallback) this.onGameSelected(fallback)
      }
    },
    onProfileError () {
      this.profileNeedsReload = false
      // При ошибке профиля показываем экран ошибки
      this.isLoadingProfile = false
      this.hasLoadingError = true
      
      if (this.loadingTimeoutId) {
        clearTimeout(this.loadingTimeoutId)
        this.loadingTimeoutId = null
      }
      
      this.player = null
      this.fullStats = null
    },
    avatarOrDefault (avatar) {
      if (!avatar || avatar === 'https://d50m6q67g4bn3.cloudfront.net/avatars/084a317c-6346-4dde-ab85-744f469fc217_1464715706995') {
        return this.defaultAvatar
      }
      return avatar
    },
    async searchPlayerFromFavorites (favorite) {
      this.cancelQueuedProfileLoad()
      const nickname = typeof favorite === 'string' ? favorite : favorite.nickname
      const game = typeof favorite === 'string' ? this.selectedGame : normalizeGame(favorite.game)
      this.onGameSelected(game, false)
      this.nickname = nickname
      this.profileNeedsReload = true
      await this.$nextTick()
      this.$refs.playerSearch?.findPlayer({ nickname })
    },
    retryLoading () {
      // Сбрасываем ошибку и повторяем загрузку
      this.hasLoadingError = false
      this.startLoading()
      
      // Повторяем поиск текущего игрока
      if (this.nickname) {
        this.$refs.playerSearch?.findPlayer({ nickname: this.nickname })
      }
    },
    resetToSearch () {
      this.cancelQueuedProfileLoad()
      this.profileNeedsReload = false
      this.$refs.playerSearch?.cancelRequests()
      // Сбрасываем все состояния и возвращаемся к поиску
      this.clearLoadingState()
      this.player = null
      this.fullStats = null
      this.nickname = null
      this.localStorageNickname = null
    },
    startLoading () {
      if (this.loadingTimeoutId) clearTimeout(this.loadingTimeoutId)
      this.isLoadingProfile = true
      this.hasLoadingError = false
      
      // Устанавливаем таймаут на 15 секунд
      this.loadingTimeoutId = setTimeout(() => {
        if (this.isLoadingProfile) {
          this.isLoadingProfile = false
          this.hasLoadingError = true
          
          // Отслеживаем таймаут загрузки
          if (this.$analytics) {
            this.$analytics.trackEvent('profile_loading_timeout', {
              nickname: this.nickname,
              timeout_duration: 15000
            })
          }
        }
      }, 15000)
    },
    clearLoadingState () {
      this.isLoadingProfile = false
      this.hasLoadingError = false
      
      if (this.loadingTimeoutId) {
        clearTimeout(this.loadingTimeoutId)
        this.loadingTimeoutId = null
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.stats-base {
  width: 340px;
  min-height: 420px;
}

#background {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  -webkit-filter: grayscale(100%) blur(2px);
  filter: grayscale(100%) blur(2px);
  background-repeat: no-repeat;
  background-position: center center;
  background-size: cover;
  z-index: -1;
}

.content {
  padding: 8px;
}
</style>

<!--
{
  "items": [
    {
      "player_id": "bce53ecc-77bd-49fe-86c4-928a60955818",
      "nickname": "kickeR",
      "status": "BUSY",
      "games": [
        {
          "name": "csgo",
          "skill_level": "9"
        },
        {
          "name": "pubg",
          "skill_level": "4"
        }
      ],
      "country": "CV",
      "verified": false,
      "avatar": "https://cdn.faceit.com/avatars/bce53ecc-77bd-49fe-86c4-928a60955818_1538342420871.jpg"
    },
    ...
}-->
