import 'bootstrap/dist/css/bootstrap.min.css'
import { Rajdhani } from 'next/font/google'

const techFont = Rajdhani({ 
  subsets: ['latin'], 
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-tech',
  display: 'swap',
})

export const metadata = {
  title: 'SCOPTO.IO | Pro Crypto Analytics',
  description: 'Advanced Web3 Portfolio Tracker & Market Intelligence',
  icons: {
    icon: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={techFont.variable}>
      <head>
        <meta name="theme-color" content="#050505" />
      </head>
      <body style={{ backgroundColor: '#050505', margin: 0, minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}