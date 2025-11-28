'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import StickyTabs from '@/components/StickyTabs'
import Gallery from '@/components/Gallery'
import PdfViewer from '@/components/PdfViewer'
import { NegativeOccurrenceChart, NegativeGenesChart } from '@/components/NegativeCharts'

const SAMPLES = [
  'MEND154', 'MEND156', 'MEND157', 'MEND158', 'MEND159', 'MEND160',
  'MEND161', 'MEND162',
]

const MARKERS = ['PLA2G2A', 'SPON2', 'TFF3']
const METHODS = ['BioFlow', 'Ground Truth', 'STFlow', 'STEM', 'MERGE', 'TRIPLEX']

// 将显示名称映射到文件名格式
const methodToFileName = (method: string): string => {
  if (method === 'Ground Truth') {
    return 'ground_truth'
  }
  return method
}

// 生成 gallery items
const generateGalleryItems = () => {
  const items: Array<{
    id: string
    image: string
    title: string
    dataset?: string
    gene?: string
    filter?: string
  }> = []

  SAMPLES.forEach((sample) => {
    MARKERS.forEach((gene) => {
      METHODS.forEach((method) => {
        const fileName = methodToFileName(method)
        items.push({
          id: `${sample}_${gene}_${method}`,
          image: `/assets/figs/${sample}_${gene}_${fileName}.png`,
          title: `${method}`,
          dataset: sample,
          gene: gene,
          filter: method,
        })
      })
    })
  })

  return items
}

const galleryItems = generateGalleryItems()

export default function Home() {
  const [activeResultTab, setActiveResultTab] = useState('accuracy')
  const accuracyRef = useRef<HTMLDivElement>(null)
  const comparisonRef = useRef<HTMLDivElement>(null)
  const resultsSectionRef = useRef<HTMLDivElement>(null)

  // 自动切换 tab 基于滚动位置（带平滑过渡）
  useEffect(() => {
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (!resultsSectionRef.current) {
            ticking = false
            return
          }

          const section = resultsSectionRef.current
          const sectionTop = section.offsetTop
          const sectionHeight = section.offsetHeight
          const scrollY = window.scrollY
          const viewportCenter = scrollY + window.innerHeight / 2

          // 检查是否在 Results section 内
          if (viewportCenter < sectionTop || viewportCenter > sectionTop + sectionHeight) {
            ticking = false
            return
          }

          // 计算在 section 内的相对位置 (0 到 1)
          const relativePosition = (viewportCenter - sectionTop) / sectionHeight

          // 根据滚动位置切换 tab（带平滑过渡区域）
          // 使用 0.20 作为切换点，但在 0.15-0.25 之间保持当前状态，避免频繁切换
          const switchThreshold = 0.25
          const transitionZone = 0.05 // 过渡区域

          if (relativePosition > switchThreshold + transitionZone) {
            setActiveResultTab('comparison')
          } else if (relativePosition < switchThreshold - transitionZone) {
            setActiveResultTab('accuracy')
          }
          // 在过渡区域内保持当前状态

          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // 初始检查

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const resultsTabs = [
    {
      id: 'accuracy',
      label: 'Accuracy-Efficiency',
      content: (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-8"
        >
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Accuracy–Efficiency Frontier
              </h3>
              <p className="text-gray-700">
                Across HER2ST, PRAD, and READ, BioFlow consistently occupies the upper-left region
                on PCC(All) vs GPU-hours, achieving stronger accuracy with substantially lower
                compute than MERGE, TRIPLEX, and STFlow.
              </p>
            </div>
            <PdfViewer
              src="/assets/figs/acc_eff.pdf"
              alt="PCC(All) vs training GPU hours"
              minHeight="400px"
              caption="PCC(All) vs training GPU hours."
            />
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <motion.div
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
            >
              <h4 className="text-xl font-bold text-gray-900 mb-2">HER2ST (431 genes)</h4>
              <p className="text-gray-700">
                BioFlow improves PCC(All) by 27–52% over best baseline.
              </p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
            >
              <h4 className="text-xl font-bold text-gray-900 mb-2">PRAD (dense, 50 genes)</h4>
              <p className="text-gray-700">
                BioFlow improves PCC(All) by ~34% while being far faster.
              </p>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05, y: -5 }}
              className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
            >
              <h4 className="text-xl font-bold text-gray-900 mb-2">READ (few-shot)</h4>
              <p className="text-gray-700">
                BioFlow shows the smallest drop from easy to hard genes.
              </p>
            </motion.div>
          </div>
        </motion.div>
      ),
    },
    {
      id: 'comparison',
      label: 'Comparison',
      content: (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full overflow-x-auto"
        >
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full border-collapse bg-white shadow-lg rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th rowSpan={2} className="px-6 py-4 text-left font-bold text-gray-900 border-r border-gray-300">
                    Method
                  </th>
                  <th colSpan={3} className="px-6 py-4 text-center font-bold text-gray-900 border-r border-gray-300">
                    HER2ST
                  </th>
                  <th colSpan={3} className="px-6 py-4 text-center font-bold text-gray-900 border-r border-gray-300">
                    PRAD
                  </th>
                  <th colSpan={3} className="px-6 py-4 text-center font-bold text-gray-900">
                    READ
                  </th>
                </tr>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200">
                    PCC(H) <span className="text-green-600 font-normal">↑</span>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200">
                    PCC(M) <span className="text-green-600 font-normal">↑</span>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-300">
                    PCC(All) <span className="text-green-600 font-normal">↑</span>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200">
                    PCC(H) <span className="text-green-600 font-normal">↑</span>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200">
                    PCC(M) <span className="text-green-600 font-normal">↑</span>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-300">
                    PCC(All) <span className="text-green-600 font-normal">↑</span>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200">
                    PCC(H) <span className="text-green-600 font-normal">↑</span>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200">
                    PCC(M) <span className="text-green-600 font-normal">↑</span>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                    PCC(All) <span className="text-green-600 font-normal">↑</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 border-r border-gray-200">
                    MERGE
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.495
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.361
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-300">
                    0.209
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.396
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.316
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-300">
                    0.227
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.336
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.301
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700">
                    0.150
                  </td>
                </tr>
                <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 border-r border-gray-200">
                    TRIPLEX
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.467
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.349
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-300">
                    0.177
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-gray-900 border-r border-gray-200">
                    0.637
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-gray-900 border-r border-gray-200">
                    0.542
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-300">
                    0.267
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.272
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.180
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700">
                    0.006
                  </td>
                </tr>
                <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 border-r border-gray-200">
                    STFlow
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.451
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.340
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-300">
                    0.226
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.503
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.430
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-300">
                    0.289
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.415
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.320
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700">
                    0.158
                  </td>
                </tr>
                <tr className="bg-blue-50 border-b-2 border-blue-200 hover:bg-blue-100 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900 border-r border-gray-200">
                    BioFlow
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-gray-900 border-r border-gray-200">
                    0.512
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-gray-900 border-r border-gray-200">
                    0.412
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-gray-900 border-r border-gray-300">
                    0.287
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.520
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                    0.475
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-gray-900 border-r border-gray-300">
                    0.388
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-gray-900 border-r border-gray-200">
                    0.425
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-gray-900 border-r border-gray-200">
                    0.342
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-gray-900">
                    0.200
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>
      ),
    },
  ]

  return (
    <main className="min-h-screen">
      <Header />

      <Hero />

      {/* Abstract Section */}
      <motion.section
        id="abstract"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6 }}
        className="py-20 bg-white"
      >
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-gray-900 mb-6"
          >
            Abstract
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-gray-700 leading-relaxed max-w-4xl"
          >
            Spatial transcriptomics (ST) prediction from histology images benefits from diffusion
            and flow-matching generative models, but existing approaches share a critical biological
            failure mode: unconstrained trajectories in real space produce negative gene expression
            values that are biologically impossible. BioFlow introduces a conditional velocity-field
            formulation that guarantees non-negative support throughout the entire trajectory, yielding
            stable optimization and biologically valid generation. Experiments across HER2ST, PRAD,
            and READ show BioFlow improves PCC(All) by &gt;25% over the strongest baseline while being
            4×–100× faster than flow-based STFlow and orders of magnitude faster than diffusion-based
            STEM.
          </motion.p>
        </div>
      </motion.section>

      {/* Method Section */}
      <motion.section
        id="method"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6 }}
        className="py-20 bg-gray-50"
      >
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-gray-900 mb-12"
          >
            Method
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-12"
          >
            {/* First row: Left text, Right empty (user will insert image) */}
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Support-Preserving Flow Dynamics
                </h3>
                <p className="text-gray-700 mb-4">
                  We re-parameterize the conditional flow-matching velocity field so that every Euler
                  update remains within the non-negative orthant. Specifically, the constrained velocity
                  is formed by adding a softplus term to a lower bound, ensuring that intermediate
                  states never enter negative regions.
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  <li>Trajectory-level non-negativity (not post-hoc clamping)</li>
                  <li>Stabilizes training for sparse count data</li>
                  <li>Eliminates wasted compute in biologically invalid space</li>
                </ul>
              </div>
              <div>
                {/* User will insert image here */}
              </div>
            </div>

            {/* Second row: Architecture image full width (long bar) */}
            <div className="mt-8">
              <PdfViewer
                src="/assets/figs/pipeline.pdf"
                alt="Model Architecture of BioFlow"
                minHeight="500px"
                caption="Model Architecture."
                className="w-full"
              />
            </div>

            {/* Third row: Transformer velocity predictor image and MMDiT text */}
            <div className="grid md:grid-cols-2 gap-8 mt-8">
              <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <img
                  src="/assets/figs/interaction.png"
                  alt="velocity predictor"
                  className="w-full h-auto"
                />
                <p className="text-sm text-gray-500 p-4 text-center">
                  Illustration of multimodal and multiscale interactions modeled by BioFlow.
                </p>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  MMDiT-style Velocity Predictor
                </h3>
                <p className="text-gray-700 mb-4">
                  BioFlow adapts MMDiT to the ST velocity-field setting: histology spot tokens and
                  learnable gene tokens are fused by decomposed attention (image→image, image→gene,
                  gene→image, gene→gene), gated for controllable cross-modal influence.
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  <li>Unified multimodal sequencing</li>
                  <li>Four-quadrant decomposed attention</li>
                  <li>Captures both local co-expression and long-range regulation</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Results Section */}
      <motion.section
        ref={resultsSectionRef}
        id="results"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6 }}
        className="py-20 bg-white"
      >
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-gray-900 mb-12"
          >
            Results
          </motion.h2>

          {/* Fixed Tabs */}
          <div className="mb-8">
            <div className="flex gap-2 border-b border-gray-200">
              {resultsTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveResultTab(tab.id)}
                  className={`px-6 py-3 rounded-t-lg font-medium transition-all whitespace-nowrap ${
                    activeResultTab === tab.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-transparent text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
      </div>

          {/* Tab Content */}
          <div className="relative min-h-[600px]">
            <AnimatePresence mode="wait">
              {resultsTabs.map((tab) => 
                activeResultTab === tab.id ? (
                  <motion.div
                    key={tab.id}
                    ref={tab.id === 'accuracy' ? accuracyRef : tab.id === 'comparison' ? comparisonRef : null}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                  >
                    {tab.content}
                  </motion.div>
                ) : null
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.section>

      {/* Negative Analysis Section */}
      <motion.section
        id="negatives"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6 }}
        className="py-20 bg-gray-50"
      >
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-gray-900 mb-6"
          >
            Negative Value Analysis
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-gray-700 mb-8 max-w-4xl"
          >
            Baseline generative models traverse unconstrained real-valued paths, leading to negative
            intermediate or final expression values. BioFlow's support-preserving dynamics fully avoid
            this failure mode, yielding 0% negative spots and genes.
          </motion.p>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-lg border border-gray-200 overflow-hidden shadow-sm bg-white"
            >
              <NegativeOccurrenceChart />
              <p className="text-sm text-gray-500 p-4 text-center">
                Negative value occurrence rate (% of spots with any negative value across genes).
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-lg border border-gray-200 overflow-hidden shadow-sm bg-white"
            >
              <NegativeGenesChart />
              <p className="text-sm text-gray-500 p-4 text-center">
                Percentage of genes with negative values.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Marker Genes Section with Gallery */}
      <motion.section
        id="markers"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6 }}
        className="py-20 bg-white"
      >
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-gray-900 mb-6"
          >
            Marker Gene Predictions
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-gray-700 mb-8 max-w-4xl"
          >
            We visualize marker-gene spatial patterns across 8 samples and 5 methods: BioFlow, Ground Truth,
            STFlow, STEM, MERGE, TRIPLEX.
          </motion.p>

          <Gallery
            items={galleryItems}
            datasets={SAMPLES}
            genes={MARKERS}
            filters={METHODS}
          />
        </div>
      </motion.section>

      {/* Citation Section */}
      <motion.section
        id="citation"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6 }}
        className="py-20 bg-gray-50"
      >
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-bold text-gray-900 mb-6"
          >
            Citation
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg text-gray-700 mb-6"
          >
            If you find BioFlow useful, please cite:
          </motion.p>
          <motion.pre
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-gray-900 text-gray-100 p-6 rounded-lg overflow-x-auto"
          >
            <code>{`@inproceedings{bioflow2026,
  title     = {BioFlow: Biologically Valid Generative Flow for Histology-Conditioned Spatial Transcriptomics Prediction},
  author    = {Anonymous},
  booktitle = {CVPR},
  year      = {2026}
}`}</code>
          </motion.pre>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm">
            Project page template styled for CVPR-style academic release.
          </p>
        </div>
      </footer>
    </main>
  )
}

