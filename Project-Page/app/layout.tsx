import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], weight: ['400', '600', '800'] })

export const metadata: Metadata = {
  title: 'BioFlow: Biologically Valid Generative Flow for Histology-Conditioned ST Prediction',
  description: 'Biologically valid flow matching for histology-conditioned spatial transcriptomics prediction.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}


