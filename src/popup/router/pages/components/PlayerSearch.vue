<template>
  <div class="player-search">
    <cool-select
      v-model="nickname"
      :items="players"
      :loading="loading"
      item-text="nickname"
      item-value="nickname"
      :placeholder="$browser.i18n.getMessage('playerSearchPlaceholder')"
      class="search-select"
      disable-filtering-by-search
      @search="onSearch"
      @select="findPlayer"
      @click="nickname = null"
    >
      <template slot="no-data">
        {{
          noData
            ? $browser.i18n.getMessage('searchPlayerNoPlayeyFoundByRequest')
            : $browser.i18n.getMessage('searchPlayerMinimalLettersInfo', searchLettersLimit + '')
        }}
      </template>
      <template
        slot="item"
        slot-scope="{ item: playerSearch }"
      >
        <div class="search-item">
          <img
            :src="avatarOrDefault(playerSearch.avatar)"
            alt="avatar"
            class="search-avatar"
          >

          <span class="search-name">
            {{ playerSearch.nickname }}
            <img
              v-if="playerSearch.verified"
              :src="$browser.runtime.getURL(`assets/verified.png`)"
              alt="verified"
              class="verified-icon"
            >
          </span>

          <img
            v-if="getPlayerSearchLvl(playerSearch) !== null"
            :src="$browser.runtime.getURL(`assets/skill_level_${getPlayerSearchLvl(playerSearch)}_svg.svg`)"
            alt="lvl icon"
            class="level-icon"
          >
          <span v-else-if="selectedGame === 'ow2'" class="unranked-level">{{ $browser.i18n.getMessage('ow2Unranked') || 'Unranked' }}</span>
        </div>
      </template>
    </cool-select>
  </div>
</template>

<script>
import { CoolSelect } from 'vue-cool-select'
import { faceitApi } from '../../../services/faceitApi.js'
import { validSkillLevel } from '../../../utils/gamePolicy.js'
import { logWarning, logUserAction, logCriticalError } from '../../../services/sentry.js'

export default {
  name: 'PlayerSearch',
  components: {
    CoolSelect
  },
  props: {
    selectedGame: {
      type: String,
      default: 'csgo'
    },
    initialNickname: {
      type: String,
      default: null
    }
  },
  data () {
    return {
      nickname: this.initialNickname,
      players: [],
      loading: false,
      searchTimeoutId: null,
      profileRequestId: 0,
      searchRequestId: 0,
      searchLettersLimit: 2,
      noData: false,
      defaultAvatar: 'https://cdn-frontend.faceit.com/web/54-1542827848/static/media/avatar_default_user_300x300.8befe042.jpg'
    }
  },
  watch: {
    selectedGame () {
      this.cancelRequests()
      // При смене игры очищаем результаты поиска
      this.players = []
      this.noData = false
    },
    initialNickname (newNickname) {
      this.nickname = newNickname
    }
  },
  beforeDestroy () {
    this.cancelRequests()
  },
  methods: {
    cancelRequests () {
      this.profileRequestId++
      this.searchRequestId++
      clearTimeout(this.searchTimeoutId)
      this.loading = false
    },
    async findPlayer ({ nickname = this.nickname } = {}) {
      if (typeof nickname !== 'string' || nickname.trim().length < 2) return
      let parsedNickname = nickname.trim()
      if (parsedNickname.includes('faceit.com')) {
        const match = parsedNickname.match(/players\/([^/?#]+)/)
        if (!match) return
        parsedNickname = match[1]
        try {
          parsedNickname = decodeURIComponent(parsedNickname)
        } catch (_) {
          // Keep malformed encodings in the normal request and UI error flow.
        }
      }
      this.cancelRequests()
      const requestId = this.profileRequestId
      const game = this.selectedGame
      const isCurrent = () => requestId === this.profileRequestId && game === this.selectedGame
      this.nickname = parsedNickname
      this.loading = true
      this.$emit('player-loading', { nickname: parsedNickname, game })
      const start = performance.now()
      this.$analytics.trackEvent('player_search_started', { nickname: parsedNickname, selected_game: game })
      try {
        const player = await faceitApi.getPlayer(parsedNickname, game)
        if (!isCurrent()) return
        let fullStats = null
        let statsError = false
        // No game data is a valid profile empty state, and needs no stats request.
        if (player && (game !== 'ow2' || (player.games && player.games.ow2))) {
          try {
            fullStats = await faceitApi.getPlayerStats(player.player_id, game)
          } catch (error) {
            if (!isCurrent()) return
            statsError = true
            logCriticalError(error, { context: 'player_stats_loading', player_id: player.player_id, selectedGame: game })
          }
        }
        if (!isCurrent()) return
        this.$analytics.trackEvent('player_search_success', { nickname: parsedNickname, player_id: player && player.player_id, selected_game: game, has_stats: !!fullStats })
        this.$analytics.trackTiming('api_response_time', Math.round(performance.now() - start))
        logUserAction('player_found_successfully', { nickname: parsedNickname, hasStats: !!fullStats })
        this.$emit('player-found', { player, fullStats, nickname: parsedNickname, game, statsError })
      } catch (error) {
        if (!isCurrent()) return
        this.$analytics.trackEvent('player_search_failed', { nickname: parsedNickname, selected_game: game, error_message: error.message })
        logWarning('Player search failed', { nickname: parsedNickname, selectedGame: game, error: error.message })
        this.$emit('player-error', { game })
      } finally {
        if (isCurrent()) this.loading = false
      }
    },
    async onSearch (search) {
      clearTimeout(this.searchTimeoutId)
      const requestId = ++this.searchRequestId
      const game = this.selectedGame
      const isCurrent = () => requestId === this.searchRequestId && game === this.selectedGame
      this.noData = false
      this.players = []
      if (search.length < this.searchLettersLimit) {
        this.loading = false
        return
      }
      this.loading = true
      this.searchTimeoutId = setTimeout(async () => {
        try {
          const { items } = await faceitApi.searchPlayers(search, game, 5)
          if (!isCurrent()) return
          this.players = items || []
          this.noData = !this.players.length
          this.$analytics.trackEvent('player_autocomplete_search', { search_query: search, result_count: this.players.length, selected_game: game })
        } catch (error) {
          if (!isCurrent()) return
          this.players = []
          this.noData = true
          logWarning('Autocomplete search failed', { search, selectedGame: game, error: error.message })
        } finally {
          if (isCurrent()) this.loading = false
        }
      }, 500)
    },

    getPlayerSearchLvl (playerSearch) {
      const games = Array.isArray(playerSearch.games) ? playerSearch.games : []
      const level = games.find(i => i.name === this.selectedGame)?.skill_level
      return validSkillLevel(level)
    },

    avatarOrDefault (avatar) {
      if (!avatar || avatar === 'https://d50m6q67g4bn3.cloudfront.net/avatars/084a317c-6346-4dde-ab85-744f469fc217_1464715706995') {
        return this.defaultAvatar
      }
      return avatar
    }
  }
}
</script>

<style lang="scss" scoped>
.player-search {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  position: relative;
}

.search-select {
  width: 100%;
  // принудительно ограничиваем выпадающий список рамками окна
  ::v-deep .cool-select__dropdown {
    max-height: 240px;
    overflow-y: auto;
  }
  // если dropdown выходит за низ, заставим его рендериться выше
  ::v-deep .cool-select__dropdown.cool-select__dropdown--position-bottom {
    bottom: auto;
    top: 100%;
  }
}

.search-item {
  display: flex;
  align-items: center;
}

.search-avatar {
  width: 48px;
}

.search-name {
  margin-left: 10px;
}

.verified-icon {
  width: 16px;
}

.level-icon {
  width: 32px;
  margin-left: auto;
}
</style>
