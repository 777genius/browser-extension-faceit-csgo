<template>
  <section class="overwatch-stats">
    <p class="source-note">{{ text('ow2Source') }}</p>
    <LoadingState v-if="isLoading" :title="text('loadingTitle')" :description="text('loadingDescription')" />
    <LoadingError
      v-else-if="hasLoadingError"
      :title="text('loadingErrorTitle')"
      :description="text('loadingErrorDescription')"
      :retry-text="text('retry')"
      :reset-text="text('searchPlayer')"
      @retry="$emit('retry-loading')"
      @reset="$emit('reset-to-search')"
    />
    <EmptyState v-else-if="!player" />
    <template v-else>
      <div class="ow2-profile">
        <FavoriteButton :player="player" selected-game="ow2" />
        <button class="profile-button" @click="openProfile">{{ text('goToProfile') }} <b>{{ nickname }}</b></button>
      </div>
      <div v-if="!gameProfile" class="ow2-empty" role="status">{{ text('ow2NoGame') }}</div>
      <template v-else>
        <div v-if="statsError" class="ow2-stats-error" role="alert">
          <p>{{ text('ow2StatsError') }}</p>
          <button @click="$emit('retry-loading')">{{ text('retry') }}</button>
        </div>
        <div v-else-if="!fullStats" class="ow2-empty" role="status">{{ text('ow2NoStats') }}</div>
        <div v-if="$route.name === 'index'" class="ow2-elo">
          <h2>Overwatch 2 · FACEIT</h2>
          <p v-if="gameProfile.game_player_name" class="game-player-name">{{ gameProfile.game_player_name }}</p>
          <p v-if="gameProfile.region">{{ text('ow2Region') }}: <b>{{ gameProfile.region }}</b></p>
          <p class="level-info">
            {{ text('level') }}
            <img v-if="rank.level" :src="$browser.runtime.getURL(`assets/skill_level_${rank.level}_svg.svg`)" :alt="String(rank.level)" class="level-icon">
            <span v-else>{{ text('ow2Unranked') }}</span>
          </p>
          <p>FACEIT Elo: <b class="elo-value">{{ rank.elo === null ? text('ow2Unavailable') : rank.elo }}</b></p>
          <template v-if="rank.range">
            <p>{{ text('eloRangeFor', String(rank.level)) }} <b>{{ rank.range[0] }} - {{ rank.level === 10 ? '∞' : rank.range[1] }}</b></p>
            <template v-if="rank.toNext !== null">
              <div class="elo-progress" role="progressbar" :aria-valuenow="rank.progress" aria-valuemin="0" aria-valuemax="100">
                <span :style="{ width: rank.progress + '%' }" />
              </div>
              <p>{{ text('playerCanRaiseLvlIfHeGets') }} <b>{{ rank.toNext }}</b> Elo.</p>
            </template>
            <p v-else>{{ text('maximalLvl') }}</p>
            <p v-if="rank.toLose !== null">{{ text('playerMayLoseLvlIfHeLoses') }} <b>{{ rank.toLose }}</b> Elo.</p>
            <p v-else>{{ text('minimalLvl') }}</p>
          </template>
          <div v-if="recentResults.length" class="ow2-results">
            <h3>{{ text('recentResults') }}</h3>
            <span v-for="(result, index) in recentResults" :key="index" :class="Number(result) === 1 ? 'win' : 'loss'">{{ Number(result) === 1 ? 'W' : 'L' }}</span>
          </div>
          <label class="save-profile">
            <input type="checkbox" :checked="localStorageNickname === nickname" @change="$emit('set-local-storage-nickname', localStorageNickname === nickname ? null : nickname)">
            {{ text('showThisProfileAfterOpening') }}
          </label>
        </div>
        <template v-else>
          <template v-if="fullStats && !statsError">
            <h2>{{ $route.name === 'map-stats' ? (mapData ? mapData.label : text('mapNotFound')) : text('overallStatistics') }}</h2>
            <p v-if="mapData" class="map-mode">{{ mapData.mode }}</p>
            <div v-if="$route.name === 'map-stats' && !mapData" class="ow2-empty" role="status">{{ text('ow2NoMap') }}</div>
            <div v-else-if="metrics.length" class="ow2-stats-table">
              <div v-for="metric in metrics" :key="metric.key" class="stat-row" :data-stat="metric.key">
                <span>{{ text(metric.label) }}</span><b>{{ metric.value }}</b>
              </div>
            </div>
            <div v-else class="ow2-empty" role="status">{{ text('ow2NoStats') }}</div>
            <template v-if="$route.name === 'full-stats'">
              <h3>{{ text('ow2Maps') }}</h3>
              <div v-if="maps.length" class="ow2-map-list">
                <router-link v-for="(map, index) in maps" :key="map.label + ':' + index" :to="{ name: 'map-stats', params: { mapLabel: map.label }, query: { mode: map.mode } }">
                  <span>{{ map.label }}</span><small>{{ map.mode }}</small>
                </router-link>
              </div>
              <p v-else class="ow2-empty">{{ text('ow2NoMaps') }}</p>
            </template>
          </template>
          <router-link v-if="$route.name === 'map-stats'" class="back-link" :to="{ name: 'full-stats' }">{{ text('backToMapsList') }}</router-link>
        </template>
      </template>
    </template>
  </section>
</template>

<script>
import FavoriteButton from './components/FavoriteButton.vue'
import EmptyState from './components/EmptyState.vue'
import LoadingState from './components/LoadingState.vue'
import LoadingError from './components/LoadingError.vue'
import { getGameProfile, getOw2Rank, getOw2Metrics, getOw2Maps } from '../../utils/gamePolicy.js'
import englishMessages from '../../../_locales/en/messages.json'

export default {
  components: { FavoriteButton, EmptyState, LoadingState, LoadingError },
  props: {
    player: { type: Object, default: null },
    fullStats: { type: Object, default: null },
    nickname: { type: String, default: null },
    localStorageNickname: { type: String, default: null },
    isLoading: { type: Boolean, default: false },
    hasLoadingError: { type: Boolean, default: false },
    statsError: { type: Boolean, default: false }
  },
  computed: {
    gameProfile () { return getGameProfile(this.player, 'ow2') },
    rank () { return getOw2Rank(this.gameProfile) },
    maps () { return getOw2Maps(this.fullStats) },
    mapData () {
      return this.maps.find(map => map.label === this.$route.params.mapLabel && (!this.$route.query.mode || map.mode === this.$route.query.mode))
    },
    metrics () {
      const stats = this.$route.name === 'map-stats' ? this.mapData && this.mapData.stats : this.fullStats && this.fullStats.lifetime
      return getOw2Metrics(stats || {})
    },
    recentResults () { return (this.fullStats && this.fullStats.lifetime && this.fullStats.lifetime['Recent Results']) || [] }
  },
  methods: {
    text (key, value) {
      return this.$browser.i18n.getMessage(key, value) || (englishMessages[key] && englishMessages[key].message) || key
    },
    openProfile () {
      const url = this.player.faceit_url || `https://www.faceit.com/en/players/${encodeURIComponent(this.nickname)}`
      this.$browser.tabs.create({ url: url.replace('{lang}', 'en') })
    }
  }
}
</script>

<style lang="scss" scoped>
.overwatch-stats { padding: 12px; border-radius: 8px; background: rgba(0, 0, 0, .85); color: white; }
.source-note { font-size: 11px; color: #ccc; margin: 0 0 12px; line-height: 1.5; }
h2 { font-size: 18px; color: #f50; }
h3 { font-size: 14px; }
p { line-height: 1.5; }
.ow2-profile { display: flex; justify-content: space-between; align-items: center; gap: 4px; }
.profile-button { font-size: 12px; text-align: right; }
button { color: #f50; background: transparent; border: 1px solid #555; border-radius: 5px; padding: 6px; cursor: pointer; }
.level-info { display: flex; align-items: center; gap: 8px; }
.level-icon { width: 32px; height: 32px; }
.elo-value { color: #f50; font-size: 22px; }
.elo-progress { height: 10px; border-radius: 5px; overflow: hidden; background: #333; }
.elo-progress span { display: block; height: 100%; background: #f50; }
.ow2-empty, .ow2-stats-error { padding: 20px 6px; line-height: 1.6; text-align: center; }
.stat-row { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid #333; font-size: 12px; }
.stat-row b { color: #f50; flex-shrink: 0; }
.ow2-map-list { display: grid; gap: 8px; }
.ow2-map-list a { display: flex; justify-content: space-between; padding: 10px; border: 1px solid #555; border-radius: 6px; color: white; text-decoration: none; }
.ow2-map-list a:hover { border-color: #f50; }
.map-mode, .ow2-map-list small { color: #bbb; }
.back-link { display: block; padding: 14px 0 2px; color: #f50; }
.ow2-results span { display: inline-block; border-radius: 50%; margin: 0 6px 8px 0; padding: 6px 8px; }
.win { background: #285d30; }
.loss { background: #7d2d25; }
.save-profile { display: flex; align-items: center; gap: 8px; margin-top: 16px; font-size: 12px; line-height: 1.5; }
</style>
