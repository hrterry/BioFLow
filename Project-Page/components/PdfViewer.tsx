'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface PdfViewerProps {
  src: string
  alt?: string
  className?: string
  minHeight?: string
  caption?: string
}

export default function PdfViewer({ 
  src, 
  alt = '', 
  className = '', 
  minHeight = '400px',
  caption 
}: PdfViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    // 将 PDF 路径转换为 PNG 路径
    const pngPath = src.replace('.pdf', '.png')
    
    // 尝试加载 PNG 图片
    const img = new Image()
    img.onload = () => {
      setImageUrl(pngPath)
      setLoading(false)
      setError(false)
    }
    img.onerror = () => {
      // 如果 PNG 不存在，尝试 JPG
      const jpgPath = src.replace('.pdf', '.jpg')
      const img2 = new Image()
      img2.onload = () => {
        setImageUrl(jpgPath)
        setLoading(false)
        setError(false)
      }
      img2.onerror = () => {
        setError(true)
        setLoading(false)
      }
      img2.src = jpgPath
    }
    img.src = pngPath
  }, [src])

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`} style={{ minHeight }}>
        <div className="text-gray-500">加载中...</div>
      </div>
    )
  }

  if (error || !imageUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-100 rounded-lg border border-gray-200 ${className}`} style={{ minHeight }}>
        <div className="text-center p-8">
          <p className="text-gray-600 mb-4">图片文件未找到</p>
          <p className="text-sm text-gray-500 mb-4">
            请将 PDF 文件转换为 PNG 格式，文件名：{src.replace('/assets/figs/', '').replace('.pdf', '.png')}
          </p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            点击此处下载原始 PDF
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="rounded-lg border border-gray-200 overflow-hidden shadow-sm"
      >
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-auto"
        />
      </motion.div>
      {caption && (
        <p className="text-sm text-gray-500 mt-4 text-center">{caption}</p>
      )}
    </div>
  )
}

