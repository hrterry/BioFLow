'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

interface GalleryItem {
  id: string
  image: string
  title: string
  dataset?: string
  gene?: string
  filter?: string
}

interface GalleryProps {
  items: GalleryItem[]
  datasets?: string[]
  genes?: string[]
  filters?: string[]
}

export default function Gallery({ items, datasets = [], genes = [], filters = [] }: GalleryProps) {
  const [selectedDataset, setSelectedDataset] = useState<string>('all')
  const [selectedGene, setSelectedGene] = useState<string>('all')
  const [selectedFilter, setSelectedFilter] = useState<string>('all')

  const filteredItems = items.filter((item) => {
    const matchDataset = selectedDataset === 'all' || item.dataset === selectedDataset
    const matchGene = selectedGene === 'all' || item.gene === selectedGene
    const matchFilter = selectedFilter === 'all' || item.filter === selectedFilter
    return matchDataset && matchGene && matchFilter
  })

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-4 mb-8 justify-center">
        {datasets.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Dataset:</label>
            <select
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="all">All</option>
              {datasets.map((dataset) => (
                <option key={dataset} value={dataset}>
                  {dataset}
                </option>
              ))}
            </select>
          </div>
        )}

        {genes.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Gene:</label>
            <select
              value={selectedGene}
              onChange={(e) => setSelectedGene(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="all">All</option>
              {genes.map((gene) => (
                <option key={gene} value={gene}>
                  {gene}
                </option>
              ))}
            </select>
          </div>
        )}

        {filters.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Filter:</label>
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              <option value="all">All</option>
              {filters.map((filter) => (
                <option key={filter} value={filter}>
                  {filter}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${selectedDataset}-${selectedGene}-${selectedFilter}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              whileHover={{ scale: 1.02, y: -5 }}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
            >
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = '/assets/figs/placeholder.png'
                  }}
                />
              </div>
              <div className="p-4">
                <h4 className="font-semibold text-gray-900">{item.title}</h4>
                {item.dataset && (
                  <p className="text-sm text-gray-500 mt-1">Dataset: {item.dataset}</p>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {filteredItems.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 text-gray-500"
        >
          No items found with the selected filters.
        </motion.div>
      )}
    </div>
  )
}


