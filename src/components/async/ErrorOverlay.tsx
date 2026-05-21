'use client'

interface Props {
  message: string
  onRetry: () => void
}

export function ErrorOverlay({ message, onRetry }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm bg-zinc-900 border border-red-800 rounded-2xl p-4 shadow-2xl flex gap-3 items-start">
        <span className="text-red-400 text-lg shrink-0">!</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-200">{message}</p>
        </div>
        <button
          onClick={onRetry}
          className="shrink-0 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
