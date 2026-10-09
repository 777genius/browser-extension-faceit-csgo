<template>
  <div class="favorites-page">
    <div class="favorites-header">
      <button
        class="back-btn"
        @click="goBack"
      >
        <i class="fas fa-arrow-left" />
        <!-- {{ $browser.i18n.getMessage('backToSearch') }} -->
      </button>
      <h2 class="page-title">
        <i class="fas fa-star" />
        {{ $browser.i18n.getMessage('favoritePlayers') }}
      </h2>
    </div>

    <div
      v-if="favoritesList.length > 0"
      class="favorites-list"
    >
      <FavoritePlayerCard
        v-for="player in favoritesList"
        :key="favoriteKey(player)"
        :player="player"
        @view-stats="viewPlayerStats"
        @remove-favorite="removeFromFavorites"
      />
    </div>

    <div
      v-else
      class="empty-favorites"
    >
      <div class="empty-content">
        <div class="empty-icon">
          <i class="fas fa-star" />
        </div>

        <h3 class="empty-title">
          {{ $browser.i18n.getMessage('noFavoritePlayers') }}
        </h3>

        <p class="empty-description">
          {{ $browser.i18n.getMessage('addFirstFavorite') }}
        </p>

        <button
          class="empty-action-btn"
          @click="goBack"
        >
          <i class="fas fa-search" />
          {{ $browser.i18n.getMessage('backToSearch') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { favoriteKey } from '../../utils/gamePolicy.js'
import FavoritePlayerCard from './components/FavoritePlayerCard.vue'

export default {
  name: 'FavoritePlayers',
  components: {
    FavoritePlayerCard
  },
  data () {
    return {
      favoritesList: []
    }
  },
  mounted () {
    this.loadFavorites()
    
    // Отслеживаем просмотр списка избранных
    this.$analytics.trackEvent('favorites_list_viewed', {
      total_favorites: this.favoritesList.length,
      has_favorites: this.favoritesList.length > 0
    })
  },
  methods: {
    favoriteKey,
    loadFavorites () {
      const stored = localStorage.getItem('favoritePlayers')
      this.favoritesList = stored ? JSON.parse(stored) : []

      // Сортируем по дате добавления (новые сверху)
      this.favoritesList.sort((a, b) => (b.added_at || 0) - (a.added_at || 0))
    },

    saveFavorites () {
      localStorage.setItem('favoritePlayers', JSON.stringify(this.favoritesList))
    },

    async viewPlayerStats (favorite) {
      const nickname = favorite.nickname
      // Отслеживаем выбор игрока из избранных
      const selectedPlayer = favorite
      this.$analytics.trackEvent('favorite_player_selected', {
        player_id: selectedPlayer?.player_id || 'unknown',
        nickname: nickname,
        skill_level: selectedPlayer?.skill_level || 'unknown',
        elo: selectedPlayer?.faceit_elo || 0,
        total_favorites: this.favoritesList.length
      })

      await this.$router.push({ name: 'index' })
      await this.$nextTick()
      this.$root.$emit('search-player', favorite)
    },

    removeFromFavorites (key) {
      const removedPlayer = this.favoritesList.find(p => favoriteKey(p) === key)
      this.favoritesList = this.favoritesList.filter(player => favoriteKey(player) !== key)
      this.saveFavorites()

      // Отслеживаем удаление из избранного на странице избранных
      this.$analytics.trackEvent('player_removed_from_favorites', {
        player_id: removedPlayer?.player_id,
        nickname: removedPlayer?.nickname || 'unknown',
        skill_level: removedPlayer?.skill_level || 'unknown',
        elo: removedPlayer?.faceit_elo || 0,
        total_favorites: this.favoritesList.length,
        source: 'favorites_page'
      })

      this.$browser.notifications.create({
        type: 'basic',
        iconUrl: this.$browser.runtime.getURL('icons/icon_48.png'),
        title: this.$browser.i18n.getMessage('favoritesRemoved'),
        message: this.$browser.i18n.getMessage('favoritesRemoved')
      })
    },

    goBack () {
      this.$router.push({ name: 'index' })
    }
  }
}
</script>

<style lang="scss" scoped>
.favorites-page {
  min-height: 400px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  border: 1px solid rgba(245, 85, 0, 0.3);
  color: white;
}

.favorites-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(245, 85, 0, 0.3);
}

.page-title {
  font-size: 1.4rem;
  font-weight: 600;
  color: #f50;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;

  i {
    font-size: 1.2rem;
  }
}

.back-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.8);
  padding: 8px 12px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
    color: white;
    transform: translateY(-1px);
  }
}

.favorites-list {
  max-height: 320px;
  overflow-y: auto;

  // Кастомный скроллбар
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(245, 85, 0, 0.6);
    border-radius: 3px;

    &:hover {
      background: rgba(245, 85, 0, 0.8);
    }
  }
}

.empty-favorites {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.empty-content {
  text-align: center;
  max-width: 280px;
}

.empty-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f50, #ff7733);
  border-radius: 50%;
  box-shadow: 0 8px 25px rgba(245, 85, 0, 0.3);

  i {
    font-size: 32px;
    color: white;
  }
}

.empty-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: #777;
  margin: 0 0 12px 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.empty-description {
  font-size: 1rem;
  color: #666;
  line-height: 1.5;
  margin: 0 0 24px 0;
}

.empty-action-btn {
  background: linear-gradient(135deg, #f50, #ff6b35);
  border: none;
  border-radius: 8px;
  color: white;
  padding: 12px 20px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 auto;

  &:hover {
    background: linear-gradient(135deg, #ff6b35, #f50);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(245, 85, 0, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
}

// Анимация появления страницы
.favorites-page {
  animation: fadeInUp 0.5s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
