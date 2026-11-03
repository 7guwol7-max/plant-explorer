/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // 사진(base64)을 서버 함수로 보내므로 요청 본문 한도를 넉넉히 둠
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
