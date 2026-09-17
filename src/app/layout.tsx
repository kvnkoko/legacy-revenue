import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Toaster } from 'sonner';
import { AuthzProvider } from '@/components/authz/AuthzProvider';
import './globals.css';

// Self-hosted so the app never blocks on a third-party font CDN. The previous
// render-blocking <link> to api.fontshare.com left the page blank for anyone
// whose network cannot reach that host (reported from Myanmar without a VPN).
const satoshi = localFont({
  src: [
    { path: '../../public/fonts/Satoshi-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Satoshi-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/Satoshi-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../../public/fonts/Satoshi-Black.woff2', weight: '900', style: 'normal' },
  ],
  variable: '--font-satoshi',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'Legacy Revenue Finance Portal',
  description: 'Internal revenue finance portal for Legacy music distribution',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={satoshi.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = localStorage.getItem('theme');
                  var theme = (stored === 'light' || stored === 'dark')
                    ? stored
                    : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
                  document.documentElement.setAttribute('data-theme', theme);
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased min-h-screen bg-background text-primary" suppressHydrationWarning>
        <AuthzProvider>{children}</AuthzProvider>
        <Toaster position="top-right" richColors closeButton theme="system" />
      </body>
    </html>
  );
}
