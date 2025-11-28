'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'

interface Tab {
  id: string
  label: string
  content: React.ReactNode
}

interface StickyTabsProps {
  tabs: Tab[]
  sectionId: string
  sticky?: boolean
}

export default function StickyTabs({ tabs, sectionId, sticky = true }: StickyTabsProps) {
  const [activeTab, setActiveTab] = useState(tabs[0].id)
  const [isSticky, setIsSticky] = useState(false)
  const [tabsHeight, setTabsHeight] = useState(0)
  const sectionRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const placeholderRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start top', 'end bottom'],
  })

  useEffect(() => {
    if (!sticky) return

    const handleScroll = () => {
      if (sectionRef.current && tabsRef.current) {
        const sectionTop = sectionRef.current.offsetTop
        const scrollY = window.scrollY
        const shouldSticky = scrollY > sectionTop - 80
        
        if (shouldSticky !== isSticky) {
          setIsSticky(shouldSticky)
          if (!isSticky && tabsRef.current) {
            setTabsHeight(tabsRef.current.offsetHeight)
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Initial check
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isSticky, sticky])

  return (
    <section id={sectionId} ref={sectionRef} className="relative py-20">
      <div className="container mx-auto px-6">
        {sticky && <div ref={placeholderRef} style={{ height: isSticky ? tabsHeight : 0 }} />}
        <motion.div
          ref={tabsRef}
          className={`${
            sticky && isSticky ? 'fixed top-20 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm' : 'relative'
          } transition-all duration-300`}
          style={sticky && isSticky ? { padding: '1rem 0' } : {}}
        >
          <div className="container mx-auto px-6">
            <div className="flex gap-2 overflow-x-auto">
              {tabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-3 rounded-lg font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {tab.label}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="mt-8">
          {tabs.map((tab) => (
            <motion.div
              key={tab.id}
              initial={false}
              animate={{
                display: activeTab === tab.id ? 'block' : 'none',
                opacity: activeTab === tab.id ? 1 : 0,
              }}
              transition={{ duration: 0.3 }}
              className={activeTab === tab.id ? 'block' : 'hidden'}
            >
              {tab.content}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

