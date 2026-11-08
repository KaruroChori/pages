import Prism from "prismjs";

(globalThis as unknown as { Prism: typeof Prism }).Prism = Prism;
await import("prismjs/components/prism-clike");
await import("prismjs/components/prism-c");
await import("prismjs/components/prism-cpp");

export function CodeBlock({ code }: { code: string }) {
  const highlighted = Prism.highlight(code.trim(), Prism.languages.cpp!, "cpp");
  return (
    <pre className="code-block">
      <code>{highlighted}</code>
    </pre>
  );
}
