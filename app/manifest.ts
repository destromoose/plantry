import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Plantry',
    short_name: 'Plantry',
    description: 'Dinner, decided. Built from your pantry, your energy, and the day outside.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAF4EA',
    theme_color: '#FAF4EA',
    categories: ['food', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Tonight', url: '/' },
      { name: 'Shopping list', url: '/shop' },
      { name: 'This week', url: '/week' },
    ],
  }
}
