import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { ColorRestorer } from '@/components/color-restorer'
import { LayoutShell } from '@/components/layout-shell'
import { PWARegister } from '@/components/pwa-register'
import { OrderNotifier } from '@/components/order-notifier'
import { DynamicFavicon } from '@/components/dynamic-favicon'
import './globals.css'

const _inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const viewport: Viewport = {
  themeColor: '#c1272d',
}

export const metadata: Metadata = {
  title: 'Osaka POS - Punto de Venta',
  description: 'Sistema de punto de venta para restaurante japonés',
  manifest: '/api/manifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Osaka POS',
  },
  icons: {
    icon: '/api/logo?s=192',
    apple: '/api/logo?s=192',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={_inter.variable} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ColorRestorer />
          <DynamicFavicon />
          <LayoutShell>{children}</LayoutShell>
          <PWARegister />
          <OrderNotifier />
        </ThemeProvider>
      </body>
    </html>
  )
}
