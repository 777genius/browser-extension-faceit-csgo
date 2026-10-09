<template>
  <button
    :class="['favorite-btn', { 'active': isInFavorites }]"
    :title="isInFavorites ? $browser.i18n.getMessage('removeFromFavorites') : $browser.i18n.getMessage('addToFavorites')"
    @click="toggleFavorite"
  >
    <i :class="['fas', 'fa-star', { 'favorited': isInFavorites }]" />
    <span class="favorite-text">
      {{ isInFavorites ? $browser.i18n.getMessage('removeFromFavorites') : $browser.i18n.getMessage('addToFavorites') }}
    </span>
  </button>
</template>

<script>
import { getGameProfile, favoriteKey } from '../../../utils/gamePolicy.js'
export default {
  name: 'FavoriteButton',
  props: {
    selectedGame: { type: String, default: 'csgo' },
    player: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      favoritesList: []
    }
  },
  computed: {
    isInFavorites () {
      return this.favoritesList.some(fav => favoriteKey(fav) === favoriteKey({ player_id: this.player.player_id, game: this.selectedGame }))
    }
  },
  watch: {
    selectedGame () { this.loadFavorites() },
    player: {
      handler () {
        this.loadFavorites()
      },
      deep: true
    }
  },
  mounted () {
    this.loadFavorites()
  },
  methods: {
    loadFavorites () {
      const stored = localStorage.getItem('favoritePlayers')
      this.favoritesList = stored ? JSON.parse(stored) : []
    },
    saveFavorites () {
      localStorage.setItem('favoritePlayers', JSON.stringify(this.favoritesList))
    },
    toggleFavorite () {
      if (this.isInFavorites) {
        this.removeFromFavorites()
      } else {
        this.addToFavorites()
      }
    },
    addToFavorites () {
      const gameProfile = getGameProfile(this.player, this.selectedGame) || {}
      const favoritePlayer = {
        player_id: this.player.player_id,
        game: this.selectedGame,
        nickname: this.player.nickname,
        avatar: this.player.avatar,
        country: this.player.country,
        skill_level: gameProfile.skill_level,
        faceit_elo: gameProfile.faceit_elo,
        faceit_url: this.player.faceit_url,
        added_at: Date.now()
      }

      this.favoritesList.push(favoritePlayer)
      this.saveFavorites()

      this.$analytics.trackEvent('player_added_to_favorites', {
        player_id: this.player.player_id,
        nickname: this.player.nickname,
        skill_level: getGameProfile(this.player, this.selectedGame)?.skill_level || 'unknown',
        elo: getGameProfile(this.player, this.selectedGame)?.faceit_elo || 0,
        total_favorites: this.favoritesList.length
      })

      this.$browser.notifications.create({
        type: 'basic',
        iconUrl: this.$browser.runtime.getURL('icons/icon_48.png'),
        title: this.$browser.i18n.getMessage('favoritesSaved'),
        message: `${this.player.nickname} ${this.$browser.i18n.getMessage('favoritesSaved')}`
      })
    },
    removeFromFavorites () {
      const oldLength = this.favoritesList.length
      this.favoritesList = this.favoritesList.filter(fav => favoriteKey(fav) !== favoriteKey({ player_id: this.player.player_id, game: this.selectedGame }))
      this.saveFavorites()

      this.$analytics.trackEvent('player_removed_from_favorites', {
        player_id: this.player.player_id,
        nickname: this.player.nickname,
        skill_level: getGameProfile(this.player, this.selectedGame)?.skill_level || 'unknown',
        elo: getGameProfile(this.player, this.selectedGame)?.faceit_elo || 0,
        total_favorites: this.favoritesList.length,
        removed_count: oldLength - this.favoritesList.length
      })

      this.$browser.notifications.create({
        type: 'basic',
        iconUrl: this.$browser.runtime.getURL('icons/icon_48.png'),
        title: this.$browser.i18n.getMessage('favoritesRemoved'),
        message: `${this.player.nickname} ${this.$browser.i18n.getMessage('favoritesRemoved')}`
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.favorite-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.5);
  font-size: 1.2rem;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  border-radius: 6px;
}

.favorite-btn i {
  color: rgba(255, 255, 255, 0.5);
  transition: color 0.3s ease;
}

.favorite-btn i.favorited {
  color: #f50;
}

.favorite-btn:hover {
  background: rgba(245, 85, 0, 0.1);
}

.favorite-btn:hover i {
  color: #f50;
}

.favorite-text {
  font-size: 0.8rem;
  white-space: nowrap;
}

@media (max-width: 350px) {
  .favorite-text {
    display: none;
  }
}
</style>
