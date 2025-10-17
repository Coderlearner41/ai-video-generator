"use client"

export default function GelSlider() {
  return (
    <div className="w-full">
      <div className="relative h-16 bg-slate-800 rounded-full overflow-hidden border border-orange-500/30">
        {/* Animated gradient bar */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500 to-transparent animate-pulse" />

        {/* Gel effect overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-12 h-12">
            {/* Outer glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full blur-lg opacity-60 animate-pulse" />

            {/* Inner circle */}
            <div className="absolute inset-2 bg-gradient-to-br from-orange-300 to-orange-500 rounded-full shadow-lg" />

            {/* Shine effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
          </div>
        </div>

        {/* Loading text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-semibold text-sm animate-pulse">Loading Avatar...</span>
        </div>
      </div>
    </div>
  )
}
