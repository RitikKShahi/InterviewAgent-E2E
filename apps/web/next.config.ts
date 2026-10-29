import type { NextConfig } from "next";

const recruiterUrl = process.env.RECRUITER_SERVICE_URL || "http://127.0.0.1:8002";
const candidateUrl = process.env.CANDIDATE_SERVICE_URL || "http://127.0.0.1:8003";

const nextConfig: NextConfig = {
  transpilePackages: ["@deepinterview/shared"],
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/recruiter/:path*",
        destination: `${recruiterUrl}/api/recruiter/:path*`,
      },
      {
        source: "/api/candidate/:path*",
        destination: `${candidateUrl}/api/candidate/:path*`,
      },
    ];
  },
};

export default nextConfig;
