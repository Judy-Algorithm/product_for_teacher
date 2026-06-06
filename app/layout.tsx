import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "老师批改助手 Demo",
  description: "面向老师的拍照阅卷 pipeline demo"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
