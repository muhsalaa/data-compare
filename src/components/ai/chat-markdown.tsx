import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="whitespace-pre-wrap break-words">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children, className }) => (
          <code className={className ? className : 'rounded bg-muted px-1 py-0.5 text-[0.85em]'}>{children}</code>
        ),
        pre: ({ children }) => <pre className="overflow-x-auto rounded-xl border bg-muted/40 p-3 text-[0.85em]">{children}</pre>,
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[0.9em]">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="border-b">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-b last:border-b-0">{children}</tr>,
        th: ({ children }) => <th className="px-2 py-1.5 font-medium">{children}</th>,
        td: ({ children }) => <td className="px-2 py-1.5 align-top">{children}</td>,
        blockquote: ({ children }) => <blockquote className="border-l-2 pl-3 text-muted-foreground">{children}</blockquote>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
