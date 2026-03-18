"use client"

import { useEffect, useRef } from "react"
import Prism from "prismjs"
import "prismjs/themes/prism-tomorrow.css"
import "prismjs/components/prism-markup"
import "prismjs/components/prism-markup-templating"
import "prismjs/components/prism-clike"
import "prismjs/components/prism-bash"
import "prismjs/components/prism-javascript"
import "prismjs/components/prism-python"
import "prismjs/components/prism-php"
import "prismjs/components/prism-json"
import { cn } from "@/lib/utils"
import styles from "./prism-code-block.module.css"

export type PrismLanguage =
  | "bash"
  | "javascript"
  | "python"
  | "php"
  | "json"

type PrismCodeBlockProps = {
  code: string
  language: PrismLanguage
  className?: string
}

export function PrismCodeBlock({ code, language, className }: PrismCodeBlockProps) {
  const codeRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!codeRef.current) {
      return
    }
    Prism.highlightElement(codeRef.current)
  }, [code, language])

  return (
    <pre className={cn("overflow-x-auto rounded-md  bg-zinc-950! p-4", styles.codeBlock, className)}>
      <code ref={codeRef} className={`language-${language} text-sm!`}>
        {code}
      </code>
    </pre>
  )
}
