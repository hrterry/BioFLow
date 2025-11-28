'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function Header() {
  const navItems = [
    { href: '#abstract', label: 'Abstract' },
    { href: '#method', label: 'Method' },
    { href: '#results', label: 'Results' },
    { href: '#negatives', label: 'Negative Analysis' },
    { href: '#markers', label: 'Marker Genes' },
    { href: '#citation', label: 'Citation' },
  ]

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200"
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="text-2xl font-bold text-gray-900"
          >
            BioFlow
          </motion.div>
          <nav className="hidden md:flex gap-6">
            {navItems.map((item, index) => (
              <motion.a
                key={item.href}
                href={item.href}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.1 }}
                className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                {item.label}
              </motion.a>
            ))}
          </nav>
        </div>
      </div>
    </motion.header>
  )
}


