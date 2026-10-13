<template>
  <div
    v-if="hasAdvertisement"
    class="advertisement-banner"
    :class="{ 'advertisement-banner--interactive': adType === 'image' }"
    @click="adType === 'image' ? openAdvertisementLink() : null"
  >
    <iframe
      v-if="adType === 'iframe'"
      :src="adIframeSrc"
      :width="adIframeWidth"
      :height="adIframeHeight"
      frameborder="0"
      allow="autoplay"
      title="Advertisement"
      class="advertisement-banner__iframe"
    />
    <img
      v-else
      :src="adImageSrc"
      :alt="'Advertisement'"
      :style="{
        width: adImageWidth,
        height: adImageHeight,
        objectFit: 'contain'
      }"
    >
  </div>
</template>

<script>
import remoteConfig from '../../../services/remoteConfig.js'

export default {
  name: 'AdvertisementBanner',
  props: {
    suffix: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      adImageSrc: '',
      adImageHeight: '60px',
      adImageWidth: '300px',
      adImageHref: '',
      adType: 'image',
      adIframeSrc: '',
      adIframeWidth: 300,
      adIframeHeight: 100,
      hasAdvertisement: false
    }
  },
  async created() {
    try {
      await remoteConfig.initialize()
      await remoteConfig.fetchConfig()
    } catch (error) {
      console.error('Failed to initialize Remote Config in AdvertisementBanner:', error)
    }
    this.loadAdvertisementData()
  },
  methods: {
    configKey(key) {
      return this.suffix ? `${key}${this.suffix}` : key
    },
    loadAdvertisementData() {
      const s = this.suffix

      this.hasAdvertisement = remoteConfig.getBoolean(this.configKey('ad_enabled'), false)
      this.adType = remoteConfig.getString(this.configKey('ad_type'), 'image')
      this.adImageSrc = remoteConfig.getString(this.configKey('ad_img_src'), '')
      this.adImageHeight = remoteConfig.getString(this.configKey('ad_img_height'), '60px')
      this.adImageWidth = remoteConfig.getString(this.configKey('ad_img_width'), '300px')
      this.adImageHref = remoteConfig.getString(this.configKey('ad_img_href'), '')
      this.adIframeSrc = remoteConfig.getString(this.configKey('ad_iframe_src'), '')
      this.adIframeWidth = remoteConfig.getNumber(this.configKey('ad_iframe_width'), 340)
      this.adIframeHeight = remoteConfig.getNumber(this.configKey('ad_iframe_height'), 100)

      if (!['image', 'iframe'].includes(this.adType)) {
        this.adType = 'image'
      }

      if (this.adType === 'iframe' && !this.adIframeSrc.trim()) {
        this.hasAdvertisement = false
      }
      if (this.adType === 'image' && !this.adImageSrc.trim()) {
        this.hasAdvertisement = false
      }

      if (this.hasAdvertisement && this.$analytics) {
        this.$analytics.trackEvent('advertisement_impression', {
          ad_type: this.adType,
          ad_suffix: this.suffix || 'primary',
          timestamp: new Date().toISOString()
        })
      }
    },
    async refreshAdvertisement() {
      try {
        await remoteConfig.fetchConfig()
        this.loadAdvertisementData()
      } catch (error) {
        console.error('Failed to refresh advertisement data:', error)
      }
    },
    openAdvertisementLink() {
      if (this.adImageHref && this.adImageHref.trim()) {
        if (this.$analytics) {
          this.$analytics.trackEvent('advertisement_clicked', {
            ad_url: this.adImageHref,
            ad_src: this.adImageSrc,
            ad_suffix: this.suffix || 'primary',
            timestamp: new Date().toISOString()
          })
        }
        window.open(this.adImageHref, '_blank')
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.advertisement-banner {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.8);
  transition: all 0.3s ease;

  &--interactive {
    cursor: pointer;

    &:hover {
      background: rgba(0, 0, 0, 0.9);
      border-color: rgba(245, 85, 0, 0.5);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
  }

  img {
    max-width: 100%;
  }

  &__iframe {
    display: block;
    border: none;
    max-width: 100%;
  }
}
</style>
