import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "FIDI | 투자자 유형별 KRW 포트폴리오",
    description:
      "투자자 유형을 선택하고 ETF, 섹터 대표주 5종, 채권, 대체자산, 현금을 원화 기준으로 설계하는 FIDI 포트폴리오 대시보드",
    openGraph: {
      title: "FIDI · KRW Dynamic V4",
      description: "투자자 유형에서 실제 편입종목까지 한 화면에서",
      type: "website",
      images: [
        {
          url: `${origin}/og-v2.png`,
          width: 1731,
          height: 909,
          alt: "FIDI KRW Dynamic V4 포트폴리오 대시보드",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "FIDI · KRW Dynamic V4",
      description: "투자자 유형에서 실제 편입종목까지 한 화면에서",
      images: [`${origin}/og-v2.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
