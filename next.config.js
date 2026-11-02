/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Images come straight from the browser. No optimizer round trip, no server egress.
    unoptimized: true,
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
