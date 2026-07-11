/**
 * Monaco Editor wrapper component.
 *
 * Features:
 * - Syntax highlighting for all supported languages
 * - Light / dark theme (controlled by `theme` prop)
 * - Controlled value with debounced onChange for auto-save
 * - Proper sizing via parent container dimensions
 */
import { useRef, useCallback } from "react";
import MonacoEditor, { type OnMount, type Monaco } from "@monaco-editor/react";

export type EditorTheme = "light" | "dark";

// Map from our language IDs to Monaco language IDs
const MONACO_LANGUAGE_MAP: Record<string, string> = {
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  bash: "shell",
  html: "html",
  css: "css",
  sql: "sql",
};

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  theme?: EditorTheme;
  readOnly?: boolean;
  height?: string;
  fontSize?: number;
  minimap?: boolean;
  /** Called once the editor mounts — gives access to the editor instance */
  onMount?: OnMount;
}

export default function CodeEditor({
  value,
  onChange,
  language = "javascript",
  theme = "light",
  readOnly = false,
  height = "100%",
  fontSize = 14,
  minimap = false,
  onMount,
}: CodeEditorProps) {
  const monacoLanguage = MONACO_LANGUAGE_MAP[language] ?? language;
  const monacoTheme = theme === "dark" ? "vs-dark" : "vs";

  const handleChange = useCallback(
    (val: string | undefined) => {
      onChange?.(val ?? "");
    },
    [onChange],
  );

  const handleMount: OnMount = (editor, monaco) => {
    // Add keyboard shortcut hints
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      // Ctrl+Enter → trigger run (parent handles via editor action)
    });

    // Auto-format on paste
    editor.onDidPaste(() => {
      editor.getAction("editor.action.formatDocument")?.run();
    });

    onMount?.(editor, monaco);
  };

  return (
    <MonacoEditor
      height={height}
      language={monacoLanguage}
      theme={monacoTheme}
      value={value}
      onChange={handleChange}
      onMount={handleMount}
      options={{
        fontSize,
        minimap: { enabled: minimap },
        readOnly,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        lineNumbers: "on",
        glyphMargin: false,
        folding: true,
        lineDecorationsWidth: 8,
        lineNumbersMinChars: 3,
        renderLineHighlight: "line",
        roundedSelection: true,
        selectOnLineNumbers: true,
        smoothScrolling: true,
        cursorBlinking: "blink",
        cursorSmoothCaretAnimation: "on",
        tabSize: 2,
        insertSpaces: true,
        formatOnType: true,
        formatOnPaste: true,
        bracketPairColorization: { enabled: true },
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
        fontLigatures: true,
        padding: { top: 12, bottom: 12 },
        suggestOnTriggerCharacters: true,
        quickSuggestions: { other: true, comments: false, strings: false },
        parameterHints: { enabled: true },
        colorDecorators: true,
      }}
    />
  );
}

/** Language options for the selector dropdown */
export const LANGUAGE_OPTIONS = [
  { value: "javascript", label: "JavaScript", ext: ".js" },
  { value: "typescript", label: "TypeScript", ext: ".ts" },
  { value: "python", label: "Python 3", ext: ".py" },
  { value: "bash", label: "Bash", ext: ".sh" },
  { value: "html", label: "HTML", ext: ".html" },
  { value: "css", label: "CSS", ext: ".css" },
  { value: "sql", label: "SQL", ext: ".sql" },
];

/** Starter code templates per language */
export const STARTER_TEMPLATES: Record<string, string> = {
  javascript: `// JavaScript\nconsole.log("Hello, World!");\n`,
  typescript: `// TypeScript\nconst greeting: string = "Hello, World!";\nconsole.log(greeting);\n`,
  python: `# Python 3\nprint("Hello, World!")\n`,
  bash: `#!/bin/bash\necho "Hello, World!"\n`,
  html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>My Page</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>\n`,
  css: `/* CSS */\nbody {\n  font-family: sans-serif;\n  color: #333;\n}\n`,
  sql: `-- SQL\nSELECT 'Hello, World!' AS greeting;\n`,
};
