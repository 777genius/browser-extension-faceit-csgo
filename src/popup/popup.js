import Vue from 'vue'
import VueCompositionAPI from '@vue/composition-api'

// Подключаем Composition API для Vue 2 СРАЗУ, до других импортов
Vue.use(VueCompositionAPI)

import App from './App'
import store from '../store'
import router from './router'
import VueAxios from 'vue-plugin-axios'
import axios from 'axios'
import VueSelect from 'vue-cool-select'
import browser from 'webextension-polyfill'
import { initSentry, logCriticalError } from './services/sentry.js'
import analyticsService from './services/analytics.js'
import { createTrackedFetch } from './utils/trackedFetch.js'

// Импортируем английские сообщения для принудительного использования английского языка
// import enMessages from '../_locales/en/messages.json'
// browser.i18n.getMessage = function(messageName, substitutions) {
//     const messageData = enMessages[messageName]
//     if (!messageData) {
//         console.warn(`Message not found: ${messageName}`)
//         return messageName // возвращаем ключ если сообщение не найдено
//     }

//     let message = messageData.message || messageData

//     // Обрабатываем подстановки (placeholders)
//     if (substitutions) {
//         if (Array.isArray(substitutions)) {
//             substitutions.forEach((value, index) => {
//                 message = message.replace(new RegExp(`\\$${index + 1}`, 'g'), value)
//             })
//         } else {
//             message = message.replace(/\$1/g, substitutions)
//         }

//         // Обрабатываем именованные плейсхолдеры
//         if (messageData.placeholders) {
//             Object.keys(messageData.placeholders).forEach(placeholderName => {
//                 const placeholder = messageData.placeholders[placeholderName]
//                 if (placeholder.content) {
//                     const contentMatch = placeholder.content.match(/\$(\d+)/)
//                     if (contentMatch && substitutions) {
//                         const index = parseInt(contentMatch[1]) - 1
//                         const value = Array.isArray(substitutions) ? substitutions[index] : substitutions
//                         message = message.replace(new RegExp(`\\$${placeholderName}\\$`, 'g'), value)
//                     }
//                 }
//             })
//         }
//     }

//     return message
// }
// // Создаем браузер с принудительным английским языком
// const englishOnlyBrowser = browser

Vue.prototype.$browser = browser
Vue.prototype.$analytics = analyticsService

// Expose services to window for console debugging and tests
try {
    if (typeof window !== 'undefined') {
        window.$analytics = analyticsService
        window.$browser = browser
    }
} catch (_) {}

// Инициализация Sentry для отслеживания ошибок
initSentry(Vue)

// Глобальный обработчик ошибок Vue
Vue.config.errorHandler = function(err, vm, info) {
    logCriticalError(err, {
        context: 'vue_global_error',
        component: vm && vm.$options && vm.$options.name || 'Unknown',
        errorInfo: info,
        route: vm && vm.$route && vm.$route.name || 'unknown'
    })

    // Отправляем ошибку в Google Analytics
    analyticsService.trackError(`Vue Error: ${err.message}`, true)

    console.error('Vue global error:', err, info)
}

// Обработчик для unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
    logCriticalError(new Error(event.reason), {
        context: 'unhandled_promise_rejection',
        reason: event.reason,
        promise: event.promise
    })

    // Отправляем ошибку в Google Analytics
    analyticsService.trackError(`Promise Rejection: ${event.reason}`, false)

    console.error('Unhandled promise rejection:', event.reason)
})

// Обработчик для необработанных ошибок JavaScript
window.addEventListener('error', event => {
    logCriticalError(event.error || new Error(event.message), {
        context: 'unhandled_js_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    })

    // Отправляем ошибку в Google Analytics
    analyticsService.trackError(`JS Error: ${event.message}`, false)

    console.error('Unhandled JavaScript error:', event.error || event.message)
})

// Отслеживание сетевых ошибок через перехват fetch
const originalFetch = window.fetch
window.fetch = createTrackedFetch(originalFetch, analyticsService)

// Проверяем обновления расширения
if (chrome.runtime.onInstalled) {
    chrome.runtime.onInstalled.addListener((details) => {
        if (details.reason === 'update') {
            analyticsService.trackEvent('extension_updated', {
                previous_version: details.previousVersion,
                current_version: chrome.runtime.getManifest().version,
                update_type: details.reason
            })
        }
    })
}

// Сохраняем время начала сессии
localStorage.setItem('session_start_time', Date.now().toString())

Vue.use(VueAxios, {
    axios
})

Vue.use(VueSelect, {
    theme: 'bootstrap' // or 'material-design'
})

// Отслеживаем навигацию по роутам
router.afterEach((to, from) => {
    analyticsService.trackPageView(to.name || to.path)
    analyticsService.trackEvent('route_change', {
        from: from.name || from.path,
        to: to.name || to.path
    })
})

/* eslint-disable no-new */
new Vue({
    el: '#app',
    store,
    router,
    render: h => h(App)
})