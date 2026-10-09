import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getOw2Rank, getOw2Metrics, getGameProfile, validSkillLevel, favoriteKey, favoriteGame } from '../../src/popup/utils/gamePolicy.js'

// Independent published FACEIT OW2 contract, not values derived from the production registry.
test('OW2 Elo ranges and inclusive promotion/demotion boundaries', () => {
  const published = [[100, 500], [501, 750], [751, 900], [901, 1050], [1051, 1200], [1201, 1350], [1351, 1530], [1531, 1750], [1751, 2000], [2001, Infinity]]
  for (let index = 0; index < published.length; index++) {
    const [lower, upper] = published[index]
    const rank = getOw2Rank({ skill_level: index + 1, faceit_elo: lower })
    assert.deepEqual(rank.range, [lower, upper])
    assert.equal(rank.toLose, index === 0 ? null : 1)
    if (index < 9) {
      const atUpper = getOw2Rank({ skill_level: index + 1, faceit_elo: upper })
      assert.equal(atUpper.toNext, 1)
    } else assert.equal(rank.toNext, null)
  }
  const bronze = getOw2Rank({ skill_level: 2, faceit_elo: 625 })
  assert.equal(bronze.toNext, 126)
  assert.equal(bronze.toLose, 125)
})

test('Invalid rank data never invents an icon or a numeric Elo', () => {
  for (const value of [null, undefined, '', '0', 0, 11, 'broken', 1.5, true, false]) assert.equal(validSkillLevel(value), null)
  for (const value of ['1', '10', 5]) assert.equal(validSkillLevel(value), Number(value))
  assert.equal(getOw2Rank({ skill_level: '0', faceit_elo: 'unknown' }).elo, null)
  assert.equal(getOw2Rank({ skill_level: 2, faceit_elo: '' }).elo, null)
})

test('OW2 never borrows a CS profile, metric or nonexistent zero', () => {
  assert.equal(getGameProfile({ games: { cs2: { faceit_elo: 2000 } } }, 'ow2'), null)
  const metrics = getOw2Metrics({ 'Win rate %': '67', 'Average K/D ratios': '4.5', 'Average Headshots %': '80', 'Average Healing Done': '0' })
  assert.deepEqual(metrics.map(metric => [metric.key, metric.value]), [['Win rate %', '67%'], ['Average K/D ratios', '4.5'], ['Average Healing Done', '0']])
  assert.equal(getOw2Metrics({}).length, 0)
})

test('Favorites isolate game identities while reading legacy CS:GO entries', () => {
  assert.equal(favoriteGame({ player_id: 'same' }), 'csgo')
  assert.notEqual(favoriteKey({ player_id: 'same', game: 'ow2' }), favoriteKey({ player_id: 'same', game: 'cs2' }))
})
