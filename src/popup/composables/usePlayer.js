import { getGameProfile } from '../utils/gamePolicy.js'
import { ref, reactive } from 'vue'
import { faceitApi } from '../services/faceitApi.js'
import { logWarning, logCriticalError, logUserAction } from '../services/sentry.js'

/**
 * Composable для управления состоянием игрока
 * @returns {Object} - объект с состоянием и методами управления игроком
 */
export function usePlayer() {
    const player = ref(null)
    const fullStats = ref(null)
    const nickname = ref(null)
    const isLoading = ref(false)
    const error = ref(null)

    /**
     * Загружает данные игрока по никнейму
     * @param {string} playerNickname - Никнейм игрока
     * @param {string} game - Игра (csgo/cs2)
     * @returns {Promise<Object>} - Данные игрока и статистика
     */
    async function loadPlayer(playerNickname, game = 'csgo') {
        if (!playerNickname || playerNickname.length < 3) {
            const validationError = new Error('Nickname must be at least 3 characters')

            logWarning('Player load validation failed', {
                nickname: playerNickname,
                length: playerNickname && playerNickname.length || 0,
                game
            })

            throw validationError
        }

        isLoading.value = true
        error.value = null

        try {
            // Парсим URL если передан
            let parsedNickname = playerNickname
            if (playerNickname.includes('faceit.com')) {
                parsedNickname = playerNickname.match(/players\/(.*)/)[1]
                parsedNickname = parsedNickname.split('/')[0]

                logUserAction('parse_faceit_url_composable', {
                    originalInput: playerNickname,
                    parsedNickname,
                    game
                })
            }

            // Загружаем данные игрока
            const playerData = await faceitApi.getPlayer(parsedNickname, game)

            // Загружаем статистику игрока
            let statsData = null
            if (playerData) {
                try {
                    statsData = await faceitApi.getPlayerStats(playerData.player_id, game)
                } catch (e) {
                    // Статистика может отсутствовать для некоторых игроков
                    if (e.message.includes('404')) {
                        logWarning('Player stats not found in composable', {
                            player_id: playerData.player_id,
                            nickname: parsedNickname,
                            game
                        })
                    } else {
                        logCriticalError(e, {
                            context: 'composable_stats_loading',
                            player_id: playerData.player_id,
                            nickname: parsedNickname,
                            game
                        })
                    }
                    console.warn('Player stats not found:', e)
                }
            }

            // Обновляем состояние
            player.value = playerData
            fullStats.value = statsData
            nickname.value = parsedNickname

            logUserAction('player_loaded_composable', {
                nickname: parsedNickname,
                player_id: playerData && playerData.player_id,
                hasStats: !!statsData,
                game
            })

            return { player: playerData, fullStats: statsData, nickname: parsedNickname }
        } catch (e) {
            error.value = e
            resetPlayer()

            // Логируем ошибку загрузки игрока
            if (e.message.includes('404')) {
                logWarning('Player not found in composable', {
                    nickname: playerNickname,
                    game
                })
            } else {
                logCriticalError(e, {
                    context: 'composable_player_loading',
                    nickname: playerNickname,
                    game
                })
            }

            throw e
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Сбрасывает состояние игрока
     */
    function resetPlayer() {
        player.value = null
        fullStats.value = null
        nickname.value = null
        error.value = null

        logUserAction('player_reset_composable')
    }

    /**
     * Устанавливает данные игрока напрямую
     * @param {Object} playerData - Данные игрока
     * @param {Object} statsData - Статистика игрока
     * @param {string} playerNickname - Никнейм игрока
     */
    function setPlayer(playerData, statsData, playerNickname) {
        player.value = playerData
        fullStats.value = statsData
        nickname.value = playerNickname
        error.value = null

        logUserAction('player_set_composable', {
            nickname: playerNickname,
            player_id: playerData && playerData.player_id,
            hasStats: !!statsData
        })
    }

    /**
     * Получает аватар игрока или дефолтный
     * @returns {string} - URL аватара
     */
    function getPlayerAvatar() {
        const defaultAvatar = 'https://cdn-frontend.faceit.com/web/54-1542827848/static/media/avatar_default_user_300x300.8befe042.jpg'

        if (!player.value || !player.value.avatar || player.value.avatar === 'https://d50m6q67g4bn3.cloudfront.net/avatars/084a317c-6346-4dde-ab85-744f469fc217_1464715706995') {
            return defaultAvatar
        }

        return player.value.avatar
    }

    /**
     * Получает статистику игрока для определенной игры
     * @param {string} game - Игра (csgo/cs2)
     * @returns {Object|null} - Статистика игры
     */
    function getGameStats(game = 'csgo') {
        if (!player.value || !player.value.games) return null
        return getGameProfile(player.value, game)
    }

    return {
        player,
        fullStats,
        nickname,
        isLoading,
        error,
        loadPlayer,
        resetPlayer,
        setPlayer,
        getPlayerAvatar,
        getGameStats
    }
}