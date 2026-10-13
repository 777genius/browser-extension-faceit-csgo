import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

interface Banner {
  suffix: string; hasAdvertisement: boolean; adType: string; adImageSrc: string; adImageHref: string
  configKey(key: string): string
}
const componentSource = await readFile(new URL('../../src/popup/router/pages/components/AdvertisementBanner.vue', import.meta.url), 'utf8')
const serviceSource = await readFile(new URL('../../src/popup/services/remoteConfig.js', import.meta.url), 'utf8')
async function setup(initialized: boolean) {
  const context = vm.createContext({ console: { warn() {}, error() {}, log() {} }, Map,
    getValue: (config: { defaultConfig: Record<string, unknown>; remote: Record<string, unknown> }, key: string) => {
      const value = config.remote[key] ?? config.defaultConfig[key]
      return { asString: () => value === undefined ? '' : String(value), asBoolean: () => value === true, asNumber: () => Number(value) }
    }
  })
  vm.runInContext(serviceSource.replace(/^import .*$/gm, '').replace('export const remoteConfig', 'const remoteConfig').replace('export default remoteConfig', 'globalThis.service = remoteConfig'), context)
  const service = context.service
  service.remoteConfig = { remote: { ad_enabled: true, ad_img_src: 'https://i.imgur.com/fFlMFLd.png', ad_img_href: 'https://xplay.gg/ref/faceit_elo_statistics' } }
  await service.setDefaults()
  service.isInitialized = initialized
  context.remoteConfig = service
  const script = componentSource.match(/<script>([\s\S]*?)<\/script>/)![1]
  vm.runInContext(script.replace(/^import .*$/gm, '').replace('export default', 'globalThis.component ='), context)
  const component = context.component
  const banner = Object.assign(component.data(), { suffix: '' }, component.methods) as Banner
  return { banner, component, service }
}

test('Enabled legacy image config renders the configured image instead of a fallback iframe', async () => {
  const { banner, component } = await setup(true)
  component.methods.loadAdvertisementData.call(banner)
  assert.equal(banner.hasAdvertisement, true)
  assert.equal(banner.adType, 'image')
  assert.equal(banner.adImageSrc, 'https://i.imgur.com/fFlMFLd.png')
  assert.equal(banner.adImageHref, 'https://xplay.gg/ref/faceit_elo_statistics')
})

test('Uninitialized config keeps both advertisements disabled', async () => {
  const { banner, component } = await setup(false)
  for (const suffix of ['', '_2']) {
    banner.suffix = suffix
    component.methods.loadAdvertisementData.call(banner)
    assert.equal(banner.hasAdvertisement, false)
  }
})
