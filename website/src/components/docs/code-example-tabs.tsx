"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PrismCodeBlock } from "@/components/docs/prism-code-block"

type CodeExamples = {
  curl: string
  javascript: string
  python: string
  php: string
}

type CodeExampleTabsProps = {
  examples: CodeExamples
}

export function CodeExampleTabs({ examples }: CodeExampleTabsProps) {
  return (
    <Tabs defaultValue="curl" className="gap-3">
      <TabsList className="grid w-full grid-cols-4 bg-zinc-100">
        <TabsTrigger value="curl" className="text-xs">cURL</TabsTrigger>
        <TabsTrigger value="javascript" className="text-xs">JavaScript</TabsTrigger>
        <TabsTrigger value="python" className="text-xs">Python</TabsTrigger>
        <TabsTrigger value="php" className="text-xs">PHP</TabsTrigger>
      </TabsList>
      <TabsContent value="curl">
        <PrismCodeBlock code={examples.curl} language="bash"  />
      </TabsContent>
      <TabsContent value="javascript">
        <PrismCodeBlock code={examples.javascript} language="javascript" />
      </TabsContent>
      <TabsContent value="python">
        <PrismCodeBlock code={examples.python} language="python" />
      </TabsContent>
      <TabsContent value="php">
        <PrismCodeBlock code={examples.php} language="php" />
      </TabsContent>
    </Tabs>
  )
}
