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
    title: "FIDI | KRW Dynamic V4",
    description:
      "투자자 유형을 선택하고 자산배분, 편입종목, 동적 교체규칙을 한눈에 확인하는 FIDI 포트폴리오 대시보드",
    openGraph: {
      title: "FIDI · KRW Dynamic V4",
      description: "투자자 유형에서 포트폴리오까지",
      type: "website",
      images: [
        {
          url: `${origin}/og.png`,
          width: 1200,
          height: 630,
          alt: "FIDI KRW Dynamic V4 포트폴리오 대시보드",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "FIDI · KRW Dynamic V4",
      description: "투자자 유형에서 포트폴리오까지",
      images: [`${origin}/og.png`],
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
