"use client"

import { useEffect, useRef, useState } from "react"
import styles from "@/app/homepage.module.css"

type Metric = {
  label: string
  value: number
  suffix: string
}

function formatValue(value: number, suffix: string) {
  if (suffix === "%") return `${value.toFixed(0)}%`
  return `${value.toFixed(2)}${suffix}`
}

export function MetricsCounters({ metrics }: { metrics: Metric[] }) {
  const [hasAnimated, setHasAnimated] = useState(false)
  const [values, setValues] = useState(() => metrics.map(() => 0))
  const sectionRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = sectionRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || hasAnimated) return
        setHasAnimated(true)
      },
      { threshold: 0.35 }
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [hasAnimated])

  useEffect(() => {
    if (!hasAnimated) return

    const duration = 1200
    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - progress) ** 3

      setValues(metrics.map((metric) => metric.value * eased))

      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  }, [hasAnimated, metrics])

  return (
    <div ref={sectionRef} className={styles.roiGrid}>
      {metrics.map((metric, index) => (
        <article key={metric.label} className={styles.roiCard}>
          <strong>{formatValue(values[index] ?? 0, metric.suffix)}</strong>
          <span>{metric.label}</span>
        </article>
      ))}
    </div>
  )
}
