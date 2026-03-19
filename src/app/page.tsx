export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white px-4">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold tracking-tight">
          Quizo<span className="text-lime-400">tic</span>
        </h1>
        <p className="text-zinc-400 text-lg">
          India&apos;s live quiz platform — coming soon
        </p>
        <div className="flex gap-3 justify-center pt-4">
          <a
            href="/host"
            className="px-6 py-3 bg-lime-400 text-zinc-950 font-semibold rounded-lg hover:bg-lime-300 transition-colors"
          >
            Host a Quiz
          </a>
          <a
            href="/join"
            className="px-6 py-3 border border-zinc-700 text-zinc-300 font-semibold rounded-lg hover:border-zinc-500 transition-colors"
          >
            Join a Game
          </a>
        </div>
      </div>
    </main>
  )
}
