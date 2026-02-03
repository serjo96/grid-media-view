import { defineConfig } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  images: ['public/pwa.svg'],
  preset: {
    transparent: {
      sizes: [192, 512],
    },
    maskable: {
      sizes: [192, 512],
    },
    apple: {
      sizes: [180],
    },
    assetName: (type, size) => {
      const w = size.width
      const h = size.height

      if (type === 'transparent') return `pwa-${w}x${h}.png`
      if (type === 'maskable') return `pwa-maskable-${w}x${h}.png`
      return 'apple-touch-icon.png'
    },
  },
})

