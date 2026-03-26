import React, { useState, useEffect, useRef } from 'react'

export default function PullToRefresh({ onRefresh, children }) {
    const [startY, setStartY] = useState(0)
    const [pullDistance, setPullDistance] = useState(0)
    const [refreshing, setRefreshing] = useState(false)
    const MAX_PULL = 120
    const THRESHOLD = 80
    const scrollContainerRef = useRef(null)

    const handleTouchStart = (e) => {
        const scrollContainer = document.getElementById('main-scroll-container')
        const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY
        if (scrollTop <= 0 && !refreshing) {
            setStartY(e.touches[0].clientY)
        } else {
            setStartY(0) // disable pull
        }
    }

    const handleTouchMove = (e) => {
        if (!startY || refreshing) return
        const y = e.touches[0].clientY
        const distance = y - startY

        if (distance > 0) {
            const scrollContainer = document.getElementById('main-scroll-container')
            const scrollTop = scrollContainer ? scrollContainer.scrollTop : window.scrollY
            if (scrollTop <= 0) {
                // Prevent default scroll only when pulling at the very top
                if (e.cancelable) e.preventDefault()
                const dampedDistance = Math.min(distance * 0.4, MAX_PULL) // Add resistance
                setPullDistance(dampedDistance)
            }
        }
    }

    const handleTouchEnd = async () => {
        if (!startY || refreshing) return

        if (pullDistance >= THRESHOLD) {
            setRefreshing(true)
            setPullDistance(THRESHOLD) // Lock it at threshold while refreshing
            try {
                await onRefresh()
            } finally {
                setRefreshing(false)
                setPullDistance(0)
            }
        } else {
            // Spring back
            setPullDistance(0)
        }
        setStartY(0)
    }

    return (
        <div 
            className="w-full relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull Indicator */}
            <div 
                className="absolute top-0 left-0 w-full flex items-center justify-center pointer-events-none transition-transform duration-200"
                style={{ 
                    height: `${THRESHOLD}px`,
                    transform: `translateY(${pullDistance > 0 ? (pullDistance - THRESHOLD) : -THRESHOLD}px)`,
                    zIndex: 50 
                }}
            >
                <div className="flex flex-col items-center justify-center gap-1">
                    {refreshing ? (
                        <div className="w-6 h-6 border-2 border-[#7C3AED]/30 border-t-[#7C3AED] rounded-full animate-spin" />
                    ) : (
                        <div 
                            className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center bg-white/5"
                            style={{ transform: `rotate(${pullDistance * 3}deg)` }}
                        >
                            <span className="text-white/50 text-xs">↓</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Wrapper */}
            <div 
                className="flex-1 transition-transform duration-200"
                style={{ transform: `translateY(${pullDistance}px)` }}
            >
                {children}
            </div>
        </div>
    )
}
