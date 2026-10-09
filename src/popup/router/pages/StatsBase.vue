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
      <AppHeader @game-selected="onGameSelected" />

      <!-- Поле ввода игрока (скрывается на странице "Избранные игроки") -->
      <PlayerSearch
        v-if="$route.name !== 'favorites'"
        ref="playerSearch"
        :selected-game="selectedGame"
        :initial-nickname="nickname"
        @player-found="onPlayerFound"
        @player-error="onProfileError"
      />

      <!-- Табы (скрываются на странице "Избранные игроки") -->
      <AnimatedTabs
        v-if="player && $route.name !== 'favorites'"
        :tabs="tabs"
      />

      <!-- VIEW -->
      <router-view
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
import { GAMES } from '../../utils/constants.js'
import AdvertisementBanner from './components/AdvertisementBanner.vue'

export default {
  components: {
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
      selectedGame: localStorage.getItem('selectedGame') || GAMES.CSGO,
      isLoadingProfile: false,
      hasLoadingError: false,
      loadingTimeoutId: null
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
  async created () {
    // if nickname was saved
    if (this.nickname) {
      // Показываем состояние загрузки для сохраненного игрока
      this.startLoading()
      
      // Эмулируем поиск для сохраненного никнейма
      this.$nextTick(() => {
        this.$refs.playerSearch?.findPlayer({ nickname: this.nickname })
      })
    }

    // Слушаем событие поиска игрока из списка избранных
    this.$root.$on('search-player', this.searchPlayerFromFavorites)
  },
  beforeDestroy () {
    // Убираем слушатель при уничтожении компонента
    this.$root.$off('search-player', this.searchPlayerFromFavorites)
    
    // Очищаем таймаут загрузки
    if (this.loadingTimeoutId) {
      clearTimeout(this.loadingTimeoutId)
    }
  },
  methods: {
    setLocalStorageNickname (val) {
      this.localStorageNickname = val
    },
    onGameSelected (game) {
      const previousGame = this.selectedGame
      this.selectedGame = game

      // Если игра изменилась и есть выбранный игрок, перезагружаем данные
      if (previousGame !== game && this.player) {
        this.startLoading()
        // Пытаемся найти того же никнейма в новой игре
        this.$refs.playerSearch?.findPlayer({ nickname: this.nickname })
      }
    },
    onPlayerFound ({ player, fullStats, nickname }) {
      // Останавливаем загрузку при успешном получении данных
      this.clearLoadingState()
      
      this.player = player
      this.fullStats = fullStats
      this.nickname = nickname

      // Если у игрока отсутствуют данные по выбранной игре,
      // автоматически переключаемся на доступную игру (например, CS2).
      const availableGames = Object.keys(this.player?.games || {})
      if (availableGames.length && !this.player?.games?.[this.selectedGame]) {
        const fallbackGame = availableGames.includes('csgo') ? 'csgo' : availableGames[0]
        this.selectedGame = fallbackGame
        localStorage.setItem('selectedGame', fallbackGame)
      }
    },
    onProfileError () {
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
    async searchPlayerFromFavorites (nickname) {
      // Показываем загрузку при поиске из избранных
      this.startLoading()
      
      // Устанавливаем никнейм и выполняем поиск через компонент PlayerSearch
      this.nickname = nickname
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
      // Сбрасываем все состояния и возвращаемся к поиску
      this.clearLoadingState()
      this.player = null
      this.fullStats = null
      this.nickname = null
      this.localStorageNickname = null
    },
    startLoading () {
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
