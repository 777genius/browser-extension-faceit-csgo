function isTelemetryRequest (input) {
    try {
        const value = input && typeof input.url === 'string' ? input.url : String(input)
        const base = typeof location === 'undefined' ? undefined : location.href
        const hostname = new URL(value, base).hostname
        return ['google-analytics.com', 'sentry.io'].some(domain =>
            hostname === domain || hostname.endsWith('.' + domain))
    } catch (_) {
        return false
    }
}

function safelyReport (callback) {
    try {
        // Reporting must not change a fetch result or leak a rejected Promise.
        Promise.resolve(callback()).catch(() => {})
    } catch (_) {}
}

export function createTrackedFetch (originalFetch, analytics) {
    return async function (...args) {
        // Telemetry transport failures must not generate more telemetry requests.
        if (isTelemetryRequest(args[0])) return originalFetch.apply(this, args)

        try {
            const response = await originalFetch.apply(this, args)
            if (!response.ok) {
                safelyReport(() => analytics.trackEvent('network_error', {
                    url: args[0],
                    status: response.status,
                    status_text: response.statusText,
                    error_type: 'http_error'
                }))
            }
            return response
        } catch (error) {
            safelyReport(() => analytics.trackError(`Network Error: ${error.message}`, false))
            safelyReport(() => analytics.trackEvent('network_error', {
                url: args[0],
                error_type: 'fetch_error',
                error_message: error.message
            }))
            throw error
        }
    }
}
