import { initializeApp } from 'firebase/app'
import { getRemoteConfig, fetchAndActivate, getValue, getAll } from 'firebase/remote-config'

const firebaseConfig = {
    apiKey: "AIzaSyAAMyyxt7fmmHYNPgJPx-oyuY1vSDJIpk0",
    authDomain: "faceit-elo-stats.firebaseapp.com",
    projectId: "faceit-elo-stats",
    storageBucket: "faceit-elo-stats.firebasestorage.app",
    messagingSenderId: "442859221015",
    appId: "1:442859221015:web:b5e5eb7348ed5be69f2c52",
    measurementId: "G-0PQ4BGM7CT"
}

class RemoteConfigService {
    constructor() {
        this.app = null
        this.remoteConfig = null
        this.isInitialized = false
        this.initPromise = null
        this.cache = new Map()
        this.lastFetchTime = 0
        this.CACHE_EXPIRY = 5 * 60 * 1000 // 5 минут
    }

    async initialize() {
        if (this.initPromise) {
            return this.initPromise
        }

        this.initPromise = this._initialize()
        return this.initPromise
    }

    async _initialize() {
        try {
            // Инициализируем Firebase
            this.app = initializeApp(firebaseConfig)
            this.remoteConfig = getRemoteConfig(this.app)

            // Настройки Remote Config
            this.remoteConfig.settings = {
                minimumFetchIntervalMillis: 5 * 60 * 1000, // 5 минут для production
                fetchTimeoutMillis: 10000 // 10 секунд timeout
            }

            // Устанавливаем дефолтные значения
            await this.setDefaults()

            this.isInitialized = true
            console.log('🔧 Remote Config initialized successfully')

            return true
        } catch (error) {
            console.error('❌ Remote Config initialization failed:', error)
            this.isInitialized = false
            throw error
        }
    }

    async setDefaults() {
        const defaults = {
            // Функциональные флаги
            enable_match_predictions: false,
            enable_premium_features: false,
            enable_analytics: true,
            enable_sentry_logging: true,

            // API настройки
            api_timeout_seconds: 10,
            retry_attempts: 3,
            rate_limit_requests_per_minute: 30,

            // Рекламные баннеры
            ad_enabled: false,
            ad_img_src: '',
            ad_img_height: '60px',
            ad_img_width: '300px',
            ad_img_href: '',
            ad_type: 'iframe',
            ad_iframe_src: 'https://clash.gg/embed-ad/Fort-Knox?initialWidth=340&initialHeight=100&redirect=https%3A%2F%2Ftrk.clash.gg%2Fclick%3Fo%3D2%26a%3D773%26c%3D161&winChance=0.99',
            ad_iframe_width: 340,
            ad_iframe_height: 100,

            // Рекламный баннер 2 (нижний)
            ad_enabled_2: false,
            ad_img_src_2: '',
            ad_img_height_2: '60px',
            ad_img_width_2: '300px',
            ad_img_href_2: '',
            ad_type_2: 'iframe',
            ad_iframe_src_2: 'https://clash.gg/embed-ad/Fort-Knox?initialWidth=340&initialHeight=100&redirect=https%3A%2F%2Ftrk.clash.gg%2Fclick%3Fo%3D2%26a%3D773%26c%3D161&winChance=0.99',
            ad_iframe_width_2: 340,
            ad_iframe_height_2: 100,

            // Текстовые настройки
            welcome_message: 'Добро пожаловать в Faceit Stats!',
            announcement_text: '',
            maintenance_message: '',

            // Версионирование
            min_supported_version: '2.0.0',
            recommended_version: '2.0.0',
            force_update: false,

            // Конфигурация для экспериментов
            experiment_match_insights: false,
            experiment_player_comparison: false
        }

        if (this.remoteConfig) {
            this.remoteConfig.defaultConfig = defaults
        }
    }

    async fetchConfig() {
        if (!this.isInitialized) {
            await this.initialize()
        }

        const now = Date.now()
        if (now - this.lastFetchTime < this.CACHE_EXPIRY) {
            console.log('📱 Using cached Remote Config')
            return
        }

        try {
            console.log('🔄 Fetching Remote Config...')
            await fetchAndActivate(this.remoteConfig)
            this.lastFetchTime = now
            this.cache.clear() // Очищаем кеш после получения новых данных
            console.log('✅ Remote Config fetched and activated')
        } catch (error) {
            console.warn('⚠️ Failed to fetch Remote Config, using cached/default values:', error)
        }
    }

    getString(key, defaultValue = '') {
        if (!this.isInitialized) {
            console.warn(`⚠️ Remote Config not initialized, returning default for ${key}`)
            return defaultValue
        }

        try {
            const value = getValue(this.remoteConfig, key)
            return value.asString() || defaultValue
        } catch (error) {
            console.warn(`⚠️ Error getting string value for ${key}:`, error)
            return defaultValue
        }
    }

    getBoolean(key, defaultValue = false) {
        if (!this.isInitialized) {
            console.warn(`⚠️ Remote Config not initialized, returning default for ${key}`)
            return defaultValue
        }

        try {
            const value = getValue(this.remoteConfig, key)
            return value.asBoolean()
        } catch (error) {
            console.warn(`⚠️ Error getting boolean value for ${key}:`, error)
            return defaultValue
        }
    }

    getNumber(key, defaultValue = 0) {
        if (!this.isInitialized) {
            console.warn(`⚠️ Remote Config not initialized, returning default for ${key}`)
            return defaultValue
        }

        try {
            const value = getValue(this.remoteConfig, key)
            return value.asNumber() || defaultValue
        } catch (error) {
            console.warn(`⚠️ Error getting number value for ${key}:`, error)
            return defaultValue
        }
    }

    getJSON(key, defaultValue = {}) {
        const stringValue = this.getString(key)
        if (!stringValue) return defaultValue

        try {
            return JSON.parse(stringValue)
        } catch (error) {
            console.warn(`⚠️ Error parsing JSON for ${key}:`, error)
            return defaultValue
        }
    }

    getAllValues() {
        if (!this.isInitialized) {
            console.warn('⚠️ Remote Config not initialized')
            return {}
        }

        try {
            const all = getAll(this.remoteConfig)
            const result = {}

            for (const [key, value] of Object.entries(all)) {
                result[key] = {
                    value: value.asString(),
                    source: value.getSource()
                }
            }

            return result
        } catch (error) {
            console.warn('⚠️ Error getting all values:', error)
            return {}
        }
    }

    // Удобные методы для часто используемых настроек
    isFeatureEnabled(featureName) {
        return this.getBoolean(`enable_${featureName}`, false)
    }

    getUIConfig() {
        return {
            adEnabled: this.getBoolean('ad_enabled', false),
            adType: this.getString('ad_type', 'image'),
            adImageSrc: this.getString('ad_img_src', ''),
            adImageHeight: this.getNumber('ad_img_height', 60),
            adImageWidth: this.getNumber('ad_img_width', 300),
            adImageHref: this.getString('ad_img_href', ''),
            adIframeSrc: this.getString('ad_iframe_src', '')
        }
    }

    getAPIConfig() {
        return {
            timeout: this.getNumber('api_timeout_seconds', 10) * 1000,
            retryAttempts: this.getNumber('retry_attempts', 3),
            rateLimit: this.getNumber('rate_limit_requests_per_minute', 30)
        }
    }

    getVersionInfo() {
        return {
            minSupported: this.getString('min_supported_version', '2.0.0'),
            recommended: this.getString('recommended_version', '2.0.0'),
            forceUpdate: this.getBoolean('force_update', false)
        }
    }

    // Метод для проверки необходимости обновления
    shouldForceUpdate(currentVersion) {
        const versionInfo = this.getVersionInfo()

        if (versionInfo.forceUpdate) {
            return this.isVersionLower(currentVersion, versionInfo.minSupported)
        }

        return false
    }

    isVersionLower(version1, version2) {
        const v1Parts = version1.split('.').map(Number)
        const v2Parts = version2.split('.').map(Number)

        for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
            const v1Part = v1Parts[i] || 0
            const v2Part = v2Parts[i] || 0

            if (v1Part < v2Part) return true
            if (v1Part > v2Part) return false
        }

        return false
    }
}

// Создаем синглтон
export const remoteConfig = new RemoteConfigService()

// Экспортируем для использования в других модулях
export default remoteConfig