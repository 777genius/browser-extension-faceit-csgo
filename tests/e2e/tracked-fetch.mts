import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTrackedFetch } from '../../src/popup/utils/trackedFetch.js'

test('Blocked telemetry transport cannot recursively report its own failure', async () => {
  const failure = new Error('Analytics blocked')
  const telemetry = 'https://www.google-analytics.com/mp/collect?api_secret=redacted'
  let calls = 0
  let tracked: ReturnType<typeof createTrackedFetch>
  const pending: Array<Promise<unknown>> = []
  const nativeFetch = async () => {
    calls++
    // Stop the broken implementation's feedback loop without hiding the assertion.
    if (calls > 6) return new Response(null, { status: 204 })
    throw failure
  }
  const send = () => { pending.push(tracked(telemetry).catch(() => undefined)) }
  tracked = createTrackedFetch(nativeFetch, { trackError: send, trackEvent: send })
  await assert.rejects(tracked(telemetry), error => error === failure)
  await Promise.all(pending)
  assert.equal(calls, 1, 'Only the caller request may reach native fetch; no recursive telemetry')
})

test('Telemetry URL, Request and string inputs never report themselves', async () => {
  for (const input of [
    'https://www.google-analytics.com/mp/collect',
    new URL('https://google-analytics.com/debug/mp/collect'),
    new Request('https://o4509418472013824.ingest.de.sentry.io/api/42/envelope/')
  ]) {
    let reports = 0
    const failure = new Error('Offline')
    const tracked = createTrackedFetch(async () => { throw failure }, { trackError: () => { reports++ }, trackEvent: () => { reports++ } })
    await assert.rejects(tracked(input), error => error === failure)
    assert.equal(reports, 0)
  }
})

test('FACEIT failures still report once and preserve native arguments, receiver and response', async () => {
  const request = new Request('https://open.faceit.com/data/v4/players?nickname=missing')
  const options: RequestInit = { cache: 'no-store' }
  const receiver = {}
  const response = new Response('{}', { status: 404 })
  const reports: unknown[][] = []
  const nativeFetch = async function(this: object, ...args: unknown[]) {
    assert.equal(this, receiver)
    assert.deepEqual(args, [request, options])
    return response
  }
  const tracked = createTrackedFetch(nativeFetch, { trackError: () => {}, trackEvent: (...args: unknown[]) => { reports.push(args) } })
  assert.equal(await tracked.call(receiver, request, options), response)
  assert.equal(reports.length, 1)
  assert.equal(reports[0][0], 'network_error')
})

test('Reporting exceptions cannot change the original fetch outcome', async () => {
  const reportFailure = () => { throw new Error('Reporting failed') }
  const analytics = { trackEvent: reportFailure, trackError: reportFailure }
  const response = new Response('{}', { status: 500 })
  assert.equal(await createTrackedFetch(async () => response, analytics)('https://open.faceit.com/data/v4/players'), response)
  const networkError = new Error('Original network failure')
  await assert.rejects(createTrackedFetch(async () => { throw networkError }, analytics)('https://open.faceit.com/data/v4/players'), error => error === networkError)
})
