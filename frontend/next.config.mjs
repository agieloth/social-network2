// /** @type {import('next').NextConfig} */
// const nextConfig = {};

// export default nextConfig;

export default {
  // Pour Docker
  output: 'standalone',
  
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8080/api/:path*',
      },
    ]
  },
}