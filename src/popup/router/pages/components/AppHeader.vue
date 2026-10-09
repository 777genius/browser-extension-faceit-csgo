<template>
  <div class="app-header">
    <div class="brand-chip">Faceit Elo</div>
    <!-- Селектор игры -->
    <GameSelector :selected-game="selectedGame" @game-selected="$emit('game-selected', $event)" />

    <!-- Кнопки справа -->
    <div class="right-buttons">
      <!-- Кнопка избранных игроков -->
      <FavoritesListButton />

      <!-- Кнопка поддержки -->
      <SupportButton />
    </div>
  </div>
</template>

<script>
import GameSelector from './GameSelector.vue'
import FavoritesListButton from './FavoritesListButton.vue'
import SupportButton from './SupportButton.vue'

export default {
  name: 'AppHeader',
  props: { selectedGame: { type: String, default: 'csgo' } },
  components: {
    GameSelector,
    FavoritesListButton,
    SupportButton
  }
}
</script>

<style lang="scss" scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  border: 1px solid rgba(245, 85, 0, 0.3);
  margin-bottom: 10px;
  position: relative;
}

.brand-chip {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 0 8px;
  height: 18px;
  line-height: 18px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: #fff;
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(245, 85, 0, 0.6);
  border-radius: 8px;
  z-index: 2;
}

.right-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
