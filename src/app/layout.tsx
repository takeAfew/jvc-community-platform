import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JVC - Junior VC Community Europe",
  description: "A European community for junior professionals across the venture capital ecosystem.",
  icons: {
    icon: "/jvc-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col justify-between selection:bg-foreground selection:text-background">
        {children}
      </body>
    </html>
  );
}
