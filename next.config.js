/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Images come straight from the browser, never through the optimizer. RecipeImage and
    // Thumb ask Unsplash for the width each screen needs and load other links as they are.
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
  async headers() {
    return [
      {
        // Phones must pick up a new service worker on the next open, not days later.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}
module.exports = nextConfig
