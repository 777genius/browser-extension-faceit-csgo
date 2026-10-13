<template>
  <div class="favorite-player-card">
    <div class="player-info">
      <div class="player-avatar">
        <img
          :src="avatarOrDefault(player.avatar)"
          :alt="player.nickname"
          class="avatar-img"
        >
        <img
          v-if="player.country"
          :src="`https://flagsapi.com/${player.country.toUpperCase()}/flat/16.png`"
          alt="flag"
          class="country-flag"
        >
      </div>

      <div class="player-details">
        <div class="player-name">
          {{ player.nickname }}
        </div>
        <div
          v-if="validLevel"
          class="player-level"
        >
          <img
            :src="$browser.runtime.getURL(`assets/skill_level_${validLevel}_svg.svg`)"
            alt="level"
            class="level-icon"
          >
          <span class="elo-text">{{ player.faceit_elo || '?' }} ELO</span>
        </div>
        <div class="favorite-game">{{ gameName }}</div>
        <div class="added-date">
          {{ formatAddedDate(player.added_at) }}
        </div>
      </div>
    </div>

    <div class="player-actions">
      <button
        class="action-btn view-btn"
        :title="$browser.i18n.getMessage('viewPlayerStats')"
        @click="viewStats"
      >
        <i class="fas fa-chart-line" />
        <span>{{ $browser.i18n.getMessage('viewPlayerStats') }}</span>
      </button>

      <button
        class="action-btn remove-btn"
        :title="$browser.i18n.getMessage('removeFromFavoritesList')"
        @click="removeFromFavorites"
      >
        <i class="fas fa-trash" />
      </button>
    </div>
  </div>
</template>

<script>
import { favoriteGame, favoriteKey, GAME_OPTIONS, validSkillLevel } from '../../../utils/gamePolicy.js'
export default {
  name: 'FavoritePlayerCard',
  props: {
    player: {
      type: Object,
      required: true
    }
  },
  data () {
    return {
      defaultAvatar: 'https://cdn-frontend.faceit.com/web/54-1542827848/static/media/avatar_default_user_300x300.8befe042.jpg'
    }
  },
  computed: {
    validLevel () { return validSkillLevel(this.player.skill_level) },
    gameName () { return GAME_OPTIONS.find(game => game.value === favoriteGame(this.player)).name }
  },
  methods: {
    avatarOrDefault (avatar) {
      if (!avatar || avatar === 'https://d50m6q67g4bn3.cloudfront.net/avatars/084a317c-6346-4dde-ab85-744f469fc217_1464715706995') {
        return this.defaultAvatar
      }
      return avatar
    },

    formatAddedDate (timestamp) {
      const date = new Date(timestamp)
      const now = new Date()
      const diffInMinutes = Math.floor((now - date) / (1000 * 60))
      const diffInHours = Math.floor((now - date) / (1000 * 60 * 60))

      if (diffInMinutes < 1) {
        return this.$browser.i18n.getMessage('justNow')
      } else if (diffInMinutes < 60) {
        return this.$browser.i18n.getMessage('minutesAgo', [diffInMinutes])
      } else if (diffInHours < 24) {
        return this.$browser.i18n.getMessage('hoursAgo', [diffInHours])
      } else {
        const diffInDays = Math.floor(diffInHours / 24)
        if (diffInDays === 1) {
          return this.$browser.i18n.getMessage('yesterday')
        } else if (diffInDays < 7) {
          return this.$browser.i18n.getMessage('daysAgo', [diffInDays])
        } else {
          return date.toLocaleDateString()
        }
      }
    },

    viewStats () {
      this.$emit('view-stats', { ...this.player, game: favoriteGame(this.player) })
    },

    removeFromFavorites () {
      this.$emit('remove-favorite', favoriteKey(this.player))
    }
  }
}
</script>

<style lang="scss" scoped>
.favorite-player-card {
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(245, 85, 0, 0.3);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(245, 85, 0, 0.6);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }
}

.player-info {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.player-avatar {
  position: relative;
  margin-right: 12px;

  .avatar-img {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 2px solid rgba(245, 85, 0, 0.3);
  }

  .country-flag {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 16px;
    height: 12px;
    border-radius: 2px;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }
}

.player-details {
  flex: 1;
  color: white;

  .player-name {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 4px;
    color: #f50;
  }

  .player-level {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;

    .level-icon {
      width: 24px;
      height: 24px;
    }

    .elo-text {
      font-size: 0.9rem;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.8);
    }
  }

  .added-date {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.6);
  }
}

.player-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.action-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.8);
  padding: 8px 12px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover {
    transform: translateY(-1px);
  }

  &.view-btn {
    background: rgba(245, 85, 0, 0.2);
    border-color: rgba(245, 85, 0, 0.4);
    color: #f50;
    flex: 1;

    &:hover {
      background: rgba(245, 85, 0, 0.3);
      border-color: #f50;
      color: white;
    }
  }

  &.remove-btn {
    background: rgba(244, 67, 54, 0.2);
    border-color: rgba(244, 67, 54, 0.4);
    color: #f44336;
    min-width: 40px;
    justify-content: center;

    &:hover {
      background: rgba(244, 67, 54, 0.3);
      border-color: #f44336;
      color: white;
    }
  }

  i {
    font-size: 0.9rem;
  }
}

// Анимация появления карточки
.favorite-player-card {
  animation: slideInUp 0.4s ease-out;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
