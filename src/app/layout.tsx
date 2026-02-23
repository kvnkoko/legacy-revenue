import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { AuthzProvider } from '@/components/authz/AuthzProvider';
import './globals.css';

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap"
          rel="stylesheet"
        />
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
