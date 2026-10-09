import assert from 'node:assert/strict'
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Route } from 'playwright'

type Game = 'ow2' | 'cs2' | 'csgo'
interface GameProfile { faceit_elo: number; skill_level: number; game_player_name?: string }
interface Player { player_id: string; nickname: string; games: Partial<Record<Game, GameProfile>>; avatar?: string; verified?: boolean }
interface Match { match_id: string; competition_name: string }
interface Stats { lifetime: Record<string, string>; segments: Array<{ label: string; mode: string; type: string; stats: Record<string, string> }> }
interface Snapshot { player: Player; ow2?: { stats: Stats | null; history: { items: Match[] } }; cs2?: { stats: Stats | null; history: { items: Match[] } }; csgo?: { stats: Stats | null; history: { items: Match[] } } }
interface CaseResult { name: string; status: 'passed' | 'failed'; error?: string }
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const evidence = path.resolve(process.env.E2E_OUTPUT || path.join(root, 'e2e-results'))
await mkdir(evidence, { recursive: true })
const snapshots = await Promise.all(['kevsteer', 'Kev01Win', 'unke666'].map(async name => JSON.parse(await readFile(path.join(here, 'fixtures', `${name}.json`), 'utf8')) as Snapshot))
const fixtures = new Map(snapshots.map(snapshot => [snapshot.player.nickname.toLowerCase(), snapshot]))
const profile = await mkdtemp(path.join(process.env.TMPDIR || evidence, 'ow2-profile-'))
const extension = path.join(root, 'dist')
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true, viewport: { width: 400, height: 950 }, locale: 'en-US',
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-sandbox']
})
const results: CaseResult[] = []
const pageErrors: string[] = []
const apiCalls: string[] = []
const unexpected: string[] = []
let statsFailure = false
let live = false
let hold: { endpoint: 'stats' | 'history'; game: Game; waiting: Promise<void>; release: () => void; started: Promise<void>; notify: () => void } | null = null
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}
function holdNext(endpoint: 'stats' | 'history', game: Game) {
  const wait = deferred(), start = deferred()
  hold = { endpoint, game, waiting: wait.promise, release: wait.resolve, started: start.promise, notify: start.resolve }
  return hold
}
function releaseHeldRequest() { hold?.release() }
async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}
await context.route('https://open.faceit.com/data/v4/**', async route => {
  const url = new URL(route.request().url())
  apiCalls.push(url.pathname + url.search)
  if (live) { await route.continue(); return }
  const resource = url.pathname.replace('/data/v4/', '')
  if (resource === 'search/players') {
    const nickname = (url.searchParams.get('nickname') || '').toLowerCase()
    const game = url.searchParams.get('game') as Game
    const items = snapshots.filter(s => s.player.nickname.toLowerCase().includes(nickname)).map(s => ({ ...s.player, games: Object.keys(s.player.games).map(name => ({ name, skill_level: '0' })) }))
    assert(['ow2', 'cs2', 'csgo'].includes(game), `Unsupported search game: ${game}`)
    await json(route, { items }); return
  }
  if (resource === 'players') {
    const fixture = fixtures.get((url.searchParams.get('nickname') || '').toLowerCase())
    await json(route, fixture?.player || { errors: [{ message: 'Player not found' }] }, fixture ? 200 : 404); return
  }
  const match = resource.match(/^players\/([^/]+)\/(stats\/([^/]+)|history)$/)
  if (match) {
    const fixture = snapshots.find(s => s.player.player_id === match[1])
    const endpoint = match[2] === 'history' ? 'history' : 'stats'
    const game = (match[3] || url.searchParams.get('game')) as Game
    if (hold?.game === game && hold.endpoint === endpoint) {
      const pending = hold
      hold = null
      pending.notify()
      await pending.waiting
    }
    if (endpoint === 'stats' && statsFailure) { await json(route, { errors: [{ message: 'Temporary failure' }] }, 500); return }
    const data = fixture?.[game]
    if (endpoint === 'history') {
      const offset = Number(url.searchParams.get('offset') || 0)
      const limit = Number(url.searchParams.get('limit') || 10)
      await json(route, { items: data?.history.items.slice(offset, offset + limit) || [] }); return
    }
    await json(route, data?.stats || { errors: [{ message: 'No stats' }] }, data?.stats ? 200 : 404); return
  }
  unexpected.push(resource)
  await json(route, { errors: [{ message: 'Unexpected E2E request' }] }, 501)
})
// External telemetry/config never leaves this isolated fixture run. Game API is separately live-tested below.
await context.route(/https:\/\/(?:.*googleapis\.com|www\.google-analytics\.com|.*sentry\.io)\//, route => route.abort())
// Avoid an unrelated CDN font timeout delaying screenshots of the actual extension UI.
await context.route('**/*', route => route.request().resourceType() === 'font' ? route.abort() : route.fallback())
const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 20000 })
const extensionId = new URL(worker.url()).host
const page = await context.newPage()
page.on('pageerror', error => pageErrors.push(error.message))
const popup = `chrome-extension://${extensionId}/popup/popup.html`
async function eventually(check: () => Promise<void>, timeout = 12000) {
  const deadline = Date.now() + timeout
  let last: unknown
  do { try { await check(); return } catch (error) { last = error; await new Promise(done => setTimeout(done, 100)) } } while (Date.now() < deadline)
  throw last
}
async function textContains(selector: string, value: string) {
  await eventually(async () => assert((await page.locator(selector).innerText({ timeout: 1000 })).includes(value), `${selector} must contain ${value}`))
}
async function seed(game: Game, nickname = 'kevsteer') {
  await page.goto(popup, { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ game, nickname }) => { localStorage.clear(); localStorage.setItem('selectedGame', game); localStorage.setItem('nickname', nickname) }, { game, nickname })
  await page.reload({ waitUntil: 'domcontentloaded' })
}
async function selectGame(game: Game) {
  await page.locator('.selected-game').click()
  await page.locator(`.dropdown-item[data-game="${game}"]`).click()
}
async function caseRun(name: string, run: () => Promise<void>) {
  try { await run(); results.push({ name, status: 'passed' }); console.log(`PASS ${name}`) }
  catch (error) { const message = error instanceof Error ? error.stack || error.message : String(error); results.push({ name, status: 'failed', error: message }); console.error(`FAIL ${name}: ${message}`); await page.screenshot({ path: path.join(evidence, `failure-${results.length}.png`), fullPage: true }).catch(() => {}) }
}
try {
  await caseRun('OW2 profile, exact FACEIT metrics, full stats, map route and local icons', async () => {
    await seed('ow2')
    await textContains('.ow2-elo', '2892')
    await textContains('.selected-game', 'Overwatch 2')
    const images = await page.locator('.overwatch-stats img[src*="skill_level_"], .selected-game img').evaluateAll(elements => elements.map(el => { const img = el as HTMLImageElement; return { src: img.src, loaded: img.complete && img.naturalWidth > 0 } }))
    assert(images.length >= 2 && images.every(img => img.loaded && !img.src.includes('skill_level_0_')), 'OW2 game and valid level assets must load')
    await page.screenshot({ path: path.join(evidence, 'ow2-overview.png'), fullPage: true })
    await page.locator('a[href="#/full-stats"]').click()
    await textContains('.stat-row[data-stat="Matches"]', '792')
    await textContains('.stat-row[data-stat="Average Damage Dealt"]', '10821')
    await textContains('.stat-row[data-stat="Average Healing Done"]', '135.51')
    await textContains('.stat-row[data-stat="Matches with new stats"]', '614')
    assert(!/headshot/i.test(await page.locator('.overwatch-stats').innerText()), 'CS-only metrics must not leak into OW2')
    const map = snapshots[0].ow2!.stats!.segments[0]
    await page.locator('.ow2-map-list a').first().click()
    await textContains('.overwatch-stats', map.label)
    await textContains('.stat-row[data-stat="Matches"]', map.stats.Matches)
    await page.screenshot({ path: path.join(evidence, 'ow2-map.png'), fullPage: true })
  })
  await caseRun('OW2 match history and real competition/room links', async () => {
    await seed('ow2')
    await textContains('.ow2-elo', '2892')
    await page.locator('a[href="#/match-history"]').click()
    await textContains('.match-history', snapshots[0].ow2!.history.items[0].competition_name)
    await eventually(async () => assert.equal(await page.locator('.match-card').count(), 10))
    assert(apiCalls.some(url => url.includes('history?game=ow2')), 'History must request ow2')
    const nextPage = page.waitForResponse(response => response.url().includes('history?game=ow2&offset=10') && response.status() === 200)
    await page.locator('.load-more-btn').click()
    await nextPage
    await eventually(async () => assert.equal(await page.locator('.match-history .loading-state').count(), 0))
    assert.equal(await page.locator('.match-card').count(), 10)
    await eventually(async () => assert.equal(await page.locator('.load-more-btn').count(), 0))
    assert(apiCalls.some(url => url.includes('history?game=ow2&offset=10')), 'Pagination must advance by returned match count')
    await page.screenshot({ path: path.join(evidence, 'ow2-history.png'), fullPage: true })
  })
  await caseRun('Game switch, persisted game and favorites use the selected game Elo', async () => {
    await seed('ow2')
    await textContains('.ow2-elo', '2892')
    await page.locator('.favorite-btn').click()
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('favoritePlayers') || '[]') as Array<{ game?: string; selectedGame?: string; game_id?: string; faceit_elo: number }>)
    assert.equal(stored[0].faceit_elo, 2892, 'Favorite must store OW2 Elo rather than CS Elo')
    assert([stored[0].game, stored[0].selectedGame, stored[0].game_id].includes('ow2'), 'Favorite must carry game identity')
    await selectGame('cs2')
    await eventually(async () => { assert.equal(await page.locator('.overwatch-stats').count(), 0); assert((await page.locator('body').innerText()).includes('2310'), 'CS2 Elo must display') })
    await page.locator('.favorites-list-btn').click()
    await page.locator('.favorite-player-card .view-btn').click()
    await textContains('.ow2-elo', '2892')
    await textContains('.selected-game', 'Overwatch 2')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await textContains('.ow2-elo', '2892')
    assert.equal(await page.evaluate(() => localStorage.getItem('selectedGame')), 'ow2')
  })
  await caseRun('Valid OW2 Elo without lifetime stats and empty history is not a network error', async () => {
    await seed('ow2', 'Kev01Win')
    await textContains('.ow2-elo', '625')
    await page.locator('.ow2-empty').waitFor()
    assert.equal(await page.locator('.ow2-stats-error').count(), 0)
    await page.locator('a[href="#/match-history"]').click()
    await page.locator('.empty-matches').waitFor()
    assert.equal(await page.locator('.match-card').count(), 0)
  })
  await caseRun('CS2-only profile keeps OW2 selection and explains missing game', async () => {
    await seed('ow2', 'unke666')
    await page.locator('.ow2-empty').waitFor()
    await textContains('.selected-game', 'Overwatch 2')
    assert.equal(await page.locator('.ow2-elo').count(), 0, 'No CS Elo inside OW2 view')
  })
  await caseRun('Stats HTTP500 displays error separately from empty stats', async () => {
    try {
      statsFailure = true
      await seed('ow2')
      await page.locator('.ow2-stats-error').waitFor()
      await textContains('.ow2-elo', '2892')
    } finally { statsFailure = false }
  })
  await caseRun('Delayed OW2 stats cannot overwrite CS2 after switching games', async () => {
    await seed('cs2')
    await textContains('body', '2310')
    const pending = holdNext('stats', 'ow2')
    await selectGame('ow2')
    await Promise.race([pending.started, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OW2 request was not held')), 10000))])
    await selectGame('cs2')
    await textContains('body', '2310')
    pending.release()
    await eventually(async () => { assert.equal(await page.locator('.overwatch-stats').count(), 0); assert.equal(await page.locator('.selected-game .game-name').innerText(), 'CS2') })
    await new Promise(done => setTimeout(done, 400))
    assert.equal(await page.locator('.overwatch-stats').count(), 0)
  })
  await caseRun('Autocomplete skill_level string zero has no broken level image', async () => {
    await seed('ow2')
    await textContains('.ow2-elo', '2892')
    const input = page.locator('.player-search input').first()
    await input.click()
    await input.fill('kev')
    await page.locator('.search-item').first().waitFor()
    assert.equal(await page.locator('.search-item .level-icon').count(), 0)
    await page.locator('.search-item').filter({ hasText: 'Kev01Win' }).click()
    await textContains('.ow2-elo', '625')
  })
  await caseRun('Favorites navigation resumes interrupted load and changed game', async () => {
    await seed('cs2')
    await textContains('body', '2310')
    const pending = holdNext('stats', 'ow2')
    await selectGame('ow2')
    await Promise.race([pending.started, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('OW2 request was not held')), 10000))])
    await page.locator('.favorites-list-btn').click()
    pending.release()
    await page.locator('.back-btn').click()
    await textContains('.ow2-elo', '2892')
    await page.locator('.favorites-list-btn').click()
    await selectGame('cs2')
    await page.locator('.back-btn').click()
    await textContains('body', '2310')
    await page.locator('a[href="#/full-stats"]').click()
    await textContains('body', snapshots[0].cs2!.stats!.lifetime.Matches)
  })
  await caseRun('Same player favorites are independent per game and legacy entries restore CS:GO', async () => {
    await seed('ow2')
    await textContains('.ow2-elo', '2892')
    await page.locator('.favorite-btn').click()
    await selectGame('cs2')
    await textContains('body', '2310')
    await page.locator('.favorite-btn').click()
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('favoritePlayers') || '[]').length), 2)
    await page.locator('.favorites-list-btn').click()
    await eventually(async () => assert.equal(await page.locator('.favorite-player-card').count(), 2))
    await page.locator('.favorite-player-card').filter({ hasText: 'Overwatch 2' }).locator('.remove-btn').click()
    const remaining = await page.evaluate(() => JSON.parse(localStorage.getItem('favoritePlayers') || '[]') as Array<{ game: string }>)
    assert.deepEqual(remaining.map(favorite => favorite.game), ['cs2'])
    await page.evaluate(player => { localStorage.setItem('favoritePlayers', JSON.stringify([{ player_id: player.player_id, nickname: player.nickname, faceit_elo: 2653, skill_level: 10 }])) }, snapshots[0].player)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('.favorite-player-card .view-btn').click()
    await textContains('.selected-game', 'CS:GO')
    await textContains('body', '2653')
  })
  await caseRun('Delayed OW2 history cannot replace newly selected CS2 history', async () => {
    await seed('ow2')
    await textContains('.ow2-elo', '2892')
    const pending = holdNext('history', 'ow2')
    await page.locator('a[href="#/match-history"]').click()
    await Promise.race([pending.started, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('History request was not held')), 10000))])
    await selectGame('cs2')
    await textContains('.match-history', snapshots[0].cs2!.history.items[0].competition_name)
    pending.release()
    await new Promise(done => setTimeout(done, 400))
    assert(!(await page.locator('.match-history').innerText()).includes(snapshots[0].ow2!.history.items[0].competition_name))
  })
  if (process.env.LIVE_FACEIT === '1') {
    live = true
    await caseRun('Live FACEIT read-only canary: OW2 profile, stats and history', async () => {
      await seed('ow2')
      await page.locator('.ow2-elo').waitFor({ timeout: 30000 })
      const elo = await page.locator('.ow2-elo').innerText()
      assert(/\d{3,}/.test(elo))
      await page.locator('a[href="#/full-stats"]').click()
      await page.locator('.ow2-stats-table').waitFor({ timeout: 30000 })
      await page.locator('a[href="#/match-history"]').click()
      await page.locator('.match-card').first().waitFor({ timeout: 30000 })
      await page.screenshot({ path: path.join(evidence, 'ow2-live.png'), fullPage: true })
    })
  }
  await caseRun('No unhandled page errors, unexpected API routes or visible advertisements', async () => {
    assert.deepEqual(pageErrors, [])
    assert.deepEqual(unexpected, [])
    assert.equal(await page.locator('iframe[src*="clash.gg"], img[src*="fFlMFLd"]').count(), 0)
  })
} finally {
  releaseHeldRequest()
  await writeFile(path.join(evidence, 'results.json'), JSON.stringify({ extensionId, cases: results, apiCalls, pageErrors, unexpected }, null, 2) + '\n')
  await context.close()
}
if (results.some(result => result.status === 'failed')) process.exitCode = 1
