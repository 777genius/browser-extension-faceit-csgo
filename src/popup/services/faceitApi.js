import { FACEIT_API, GAMES, API_LIMITS } from '../utils/constants.js'
import { logApiError, logUserAction } from './sentry.js'

/**
 * @typedef {Object} Player
 * @property {string} player_id - Уникальный ID игрока
 * @property {string} nickname - Никнейм игрока
 * @property {string} avatar - URL аватара игрока
 * @property {string} country - Код страны игрока
 * @property {boolean} verified - Статус верификации
 * @property {Object} games - Объект с играми игрока
 * @property {string} faceit_url - URL профиля игрока
 */

/**
 * @typedef {Object} PlayerStats
 * @property {Object} lifetime - Статистика за все время
 * @property {Object} segments - Сегментированная статистика
 */

/**
 * @typedef {Object} Match
 * @property {string} match_id - ID матча
 * @property {string} game_id - ID игры
 * @property {string} region - Регион матча
 * @property {string} match_type - Тип матча
 * @property {number} game_mode - Режим игры
 * @property {number} max_players - Максимальное количество игроков
 * @property {Object} teams - Команды в матче
 * @property {Object} results - Результаты матча
 * @property {number} created_at - Время создания матча (timestamp)
 * @property {number} updated_at - Время обновления матча (timestamp)
 */

/**
 * @typedef {Object} ApiResponse
 * @property {Array} items - Массив элементов ответа
 * @property {number} start - Начальный индекс
 * @property {number} end - Конечный индекс
 */

/**
 * @typedef {Object} ApiError
 * @property {string} message - Сообщение об ошибке
 * @property {number} status - HTTP статус код
 * @property {string} code - Код ошибки
 */

/**
 * Единый сервис для работы с FACEIT API
 * Предоставляет методы для получения данных игроков, статистики и матчей
 *
 * @class FaceitApiService
 */
class FaceitApiService {
    /**
     * Создает экземпляр FaceitApiService
     * Инициализирует базовый URL и заголовки для API запросов
     */
    constructor() {
        this.baseUrl = FACEIT_API.BASE_URL
        this.headers = FACEIT_API.HEADERS
    }

    /**
     * Общий метод для выполнения HTTP запросов к FACEIT API
     * Обрабатывает ошибки и преобразует ответ в JSON
     *
     * @param {string} url - URL для запроса
     * @param {Object} [options={}] - Дополнительные опции для fetch
     * @returns {Promise<Object>} Результат запроса в формате JSON
     * @throws {Error} При ошибке HTTP запроса или сети
     */
    async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: this.headers,
                ...options
            })

            if (!response.ok) {
                const error = new Error(`HTTP error! status: ${response.status}`)

                // Логируем API ошибку в Sentry
                logApiError(error, {
                    url,
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries())
                })

                throw error
            }

            return await response.json()
        } catch (error) {
            console.error('API request failed:', error)

            // Логируем сетевые ошибки в Sentry
            if (!error.message.includes('HTTP error!')) {
                logApiError(error, {
                    url,
                    errorType: 'network_error',
                    options
                })
            }

            throw error
        }
    }

    /**
     * Поиск игрока по никнейму
     *
     * @param {string} nickname - Никнейм игрока для поиска
     * @param {string} [game=GAMES.CSGO] - Игра (csgo/cs2)
     * @returns {Promise<Player>} Данные найденного игрока
     * @throws {Error} При отсутствии игрока или ошибке API
     *
     * @example
     * const player = await faceitApi.getPlayer('s1mple', 'csgo')
     * console.log(player.nickname) // 's1mple'
     */
    async getPlayer(nickname, game = GAMES.CSGO) {
        logUserAction('search_player', { nickname, game })

        const url = `${this.baseUrl}/players?nickname=${encodeURIComponent(nickname)}&game=${game}`
        return await this.request(url)
    }

    /**
     * Получение детальной статистики игрока
     *
     * @param {string} playerId - Уникальный ID игрока
     * @param {string} [game=GAMES.CSGO] - Игра (csgo/cs2)
     * @returns {Promise<PlayerStats>} Статистика игрока
     * @throws {Error} При отсутствии статистики или ошибке API
     *
     * @example
     * const stats = await faceitApi.getPlayerStats('player-id', 'csgo')
     * console.log(stats.lifetime['Average K/D Ratio'])
     */
    async getPlayerStats(playerId, game = GAMES.CSGO) {
        logUserAction('load_player_stats', { playerId, game })

        const url = `${this.baseUrl}/players/${playerId}/stats/${game}`
        try {
            return await this.request(url)
        } catch (error) {
            // Статистика может отсутствовать для некоторых игроков (часто для CS:GO/CS2 миграций)
            // Не считаем это фатальной ошибкой — возвращаем null, чтобы UI продолжил работать.
            if (error && typeof error.message === 'string' && error.message.includes('404')) {
                return null
            }
            throw error
        }
    }

    /**
     * Поиск игроков по части никнейма (автокомплит)
     *
     * @param {string} nickname - Часть никнейма для поиска
     * @param {string} [game=GAMES.CSGO] - Игра (csgo/cs2)
     * @param {number} [limit=5] - Максимальное количество результатов
     * @returns {Promise<ApiResponse>} Список найденных игроков
     * @throws {Error} При ошибке поиска или API
     *
     * @example
     * const result = await faceitApi.searchPlayers('s1mp', 'csgo', 10)
     * console.log(result.items) // Массив найденных игроков
     */
    async searchPlayers(nickname, game = GAMES.CSGO, limit = 5) {
        logUserAction('search_players_autocomplete', { nickname, game, limit })

        const url = `${this.baseUrl}/search/players?nickname=${encodeURIComponent(nickname)}&game=${game}&offset=0&limit=${limit}`
        return await this.request(url)
    }

    /**
     * Получение истории матчей игрока с пагинацией
     *
     * @param {string} playerId - Уникальный ID игрока
     * @param {string} [game=GAMES.CSGO] - Игра (csgo/cs2)
     * @param {number} [offset=0] - Смещение для пагинации (с какого матча начать)
     * @param {number} [limit=API_LIMITS.MATCHES_PER_PAGE] - Количество матчей на страницу
     * @returns {Promise<ApiResponse>} История матчей игрока
     * @throws {Error} При ошибке загрузки матчей или API
     *
     * @example
     * // Получить первые 20 матчей
     * const matches = await faceitApi.getPlayerMatches('player-id', 'csgo', 0, 20)
     *
     * // Получить следующие 20 матчей
     * const nextMatches = await faceitApi.getPlayerMatches('player-id', 'csgo', 20, 20)
     */
    async getPlayerMatches(playerId, game = GAMES.CSGO, offset = 0, limit = API_LIMITS.MATCHES_PER_PAGE) {
        logUserAction('load_player_matches', { playerId, game, offset, limit })

        const url = `${this.baseUrl}/players/${playerId}/history?game=${game}&offset=${offset}&limit=${limit}`
        return await this.request(url)
    }

    /**
     * Получение последних матчей игрока (для превью/виджетов)
     * Ярлык для getPlayerMatches с лимитом 5 матчей
     *
     * @param {string} playerId - Уникальный ID игрока
     * @param {string} [game=GAMES.CSGO] - Игра (csgo/cs2)
     * @returns {Promise<ApiResponse>} Последние 5 матчей игрока
     * @throws {Error} При ошибке загрузки матчей или API
     *
     * @example
     * const recentMatches = await faceitApi.getRecentMatches('player-id', 'csgo')
     * console.log(recentMatches.items.length) // <= 5
     */
    async getRecentMatches(playerId, game = GAMES.CSGO) {
        return await this.getPlayerMatches(playerId, game, 0, 5)
    }
}

// Создаем единственный экземпляр сервиса (Singleton pattern)
export const faceitApi = new FaceitApiService()

export default faceitApi