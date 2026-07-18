'use client'

import { useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'

const MAX_INPUT_BYTES = 10 * 1024 * 1024

interface ImageUploadProps {
  imageUrl?: string
  onUpload: (url: string) => void
  onRemove: () => void
  variant?: 'question' | 'option'
}

export function ImageUpload({ imageUrl, onUpload, onRemove, variant = 'question' }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    setError('')

    if (file.size > MAX_INPUT_BYTES) {
      setError('Image too large (max 10MB). Try a smaller file.')
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('JPEG, PNG, WebP, or GIF only')
      return
    }

    let uploadFile: File = file
    if (file.type !== 'image/gif') {
      setCompressing(true)
      try {
        uploadFile = await imageCompression(file, {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: 'image/webp',
          initialQuality: 0.85,
        })
      } catch {
        uploadFile = file
      } finally {
        setCompressing(false)
      }
    }

    setUploading(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('context', variant)

      const res = await fetch('/api/upload-image', { method: 'POST', body: formData, signal: controller.signal })
      const data = await res.json()

      if (!data.success) {
        setError(data.error ?? 'Upload failed')
        return
      }

      onUpload(data.url)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Upload timed out. Check your connection and try again.')
      } else {
        setError('Upload failed. Please try again.')
      }
    } finally {
      clearTimeout(timeout)
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  if (imageUrl) {
    return (
      <div className={`relative group ${variant === 'option' ? 'w-16 h-16' : 'w-full'}`}>
        <img
          src={imageUrl}
          alt=""
          className={`rounded-lg object-cover border border-gray-200 ${
            variant === 'option' ? 'w-16 h-16' : 'w-full max-h-48'
          }`}
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          aria-label="Remove image"
          title="Remove image"
        >
          x
        </button>
      </div>
    )
  }

  if (variant === 'option') {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || compressing}
          className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-colors flex-shrink-0"
          title="Add image to option"
        >
          {uploading ? (
            <span className="w-4 h-4 border-2 border-gray-300 border-t-violet-500 rounded-full animate-spin" />
          ) : (
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
              <rect x="2" y="3" width="16" height="14" rx="2" stroke="#9ca3af" strokeWidth="1.5" />
              <circle cx="7" cy="8" r="2" stroke="#9ca3af" strokeWidth="1.5" />
              <path d="M4 15l4-4 3 3 2-2 3 3" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
        />
        {error && <span className="absolute top-full left-0 text-xs text-red-500 mt-0.5 whitespace-nowrap">{error}</span>}
      </div>
    )
  }

  return (
    <div>
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
          uploading ? 'border-violet-300 bg-violet-50' : 'border-gray-200 hover:border-violet-300 hover:bg-gray-50'
        }`}
      >
        {uploading ? (
          <span className="w-5 h-5 border-2 border-gray-300 border-t-violet-500 rounded-full animate-spin" />
        ) : (
          <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5 flex-shrink-0">
            <rect x="2" y="3" width="16" height="14" rx="2" stroke="#9ca3af" strokeWidth="1.5" />
            <circle cx="7" cy="8" r="2" stroke="#9ca3af" strokeWidth="1.5" />
            <path d="M4 15l4-4 3 3 2-2 3 3" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span className="text-sm text-gray-500">
          {compressing ? 'Compressing…' : uploading ? 'Uploading...' : 'Add image (drag or click) — max 10MB, auto-compressed'}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
