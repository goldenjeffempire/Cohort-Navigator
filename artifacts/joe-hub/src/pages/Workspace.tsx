/**
 * Free-form coding workspace — write and run any code without a challenge.
 * Code is auto-saved to localStorage per language.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useExecuteCode, type ExecutionResult } from "@/lib/coding";
import CodeEditor, { LANGUAGE_OPTIONS, STARTER_TEMPLATES, type EditorTheme } from "@/components/editor/CodeEditor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Play, Sun, Moon, Trash2, Terminal, ChevronDown, ChevronUp, Code2 } from "lucide-react";

const WS_STORAGE = (lang: string) => `joe-workspace-${lang}`;

export default function Workspace() {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(STARTER_TEMPLATES.javascript);
  const [theme, setTheme] = useState<EditorTheme>("dark");
  const [stdin, setStdin] = useState("");
  const [showStdin, setShowStdin] = useState(false);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);

  const executeMutation = useExecuteCode();
  const { toast } = useToast();
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load code from localStorage when language changes
  useEffect(() => {
    const saved = localStorage.getItem(WS_STORAGE(language));
    setCode(saved ?? STARTER_TEMPLATES[language] ?? "");
    setExecResult(null);
  }, [language]);

  // Auto-save
  const handleCodeChange = useCallback(
    (val: string) => {
      setCode(val);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        localStorage.setItem(WS_STORAGE(language), val);
      }, 1000);
    },
    [language],
  );

  const handleRun = () => {
    executeMutation.mutate(
      { code, language: language as any, stdin: stdin || undefined },
      {
        onSuccess: (result) => setExecResult(result),
        onError: (err) => toast({ title: "Execution error", description: err.message, variant: "destructive" }),
      },
    );
  };

  const handleClear = () => {
    const starter = STARTER_TEMPLATES[language] ?? "";
    setCode(starter);
    localStorage.removeItem(WS_STORAGE(language));
    setExecResult(null);
  };

  const currentLang = LANGUAGE_OPTIONS.find((l) => l.value === language);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-950 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
          <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
        </div>
        <span className="text-gray-400 font-mono text-xs">
          main{currentLang?.ext ?? ".js"}
        </span>

        <div className="ml-2">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-7 text-xs bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {LANGUAGE_OPTIONS.map((l) => (
                <SelectItem key={l.value} value={l.value} className="text-gray-200 text-xs focus:bg-gray-700">
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="text-gray-400 hover:text-white transition-colors p-1.5"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Button
            size="sm"
            variant="ghost"
            className="text-gray-400 hover:text-white hover:bg-gray-700 h-7 text-xs"
            onClick={handleClear}
            title="Reset to starter template"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 h-7 text-xs px-3"
            onClick={handleRun}
            disabled={executeMutation.isPending}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            {executeMutation.isPending ? "Running…" : "Run"}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <CodeEditor
          value={code}
          onChange={handleCodeChange}
          language={language}
          theme={theme}
          height="100%"
        />
      </div>

      {/* Stdin collapsible */}
      <div className="bg-gray-900 border-t border-gray-800 shrink-0">
        <button
          onClick={() => setShowStdin(!showStdin)}
          className="w-full flex items-center gap-2 px-4 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {showStdin ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          Standard Input (stdin)
        </button>
        {showStdin && (
          <Textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Optional stdin input for your program…"
            className="mx-4 mb-3 bg-gray-800 border-gray-700 text-gray-200 text-xs font-mono placeholder:text-gray-600 h-16 resize-none"
          />
        )}
      </div>

      {/* Output */}
      <div className="bg-gray-950 border-t border-gray-800 shrink-0">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800">
          <Terminal className="h-3.5 w-3.5 text-gray-500" />
          <span className="text-xs text-gray-500 font-mono">Output</span>
          {execResult && (
            <span className={`ml-auto text-xs ${execResult.exitCode === 0 ? "text-green-400" : "text-red-400"}`}>
              exit {execResult.exitCode} · {execResult.executionTimeMs}ms
            </span>
          )}
        </div>

        {executeMutation.isPending ? (
          <div className="px-4 py-3 text-xs text-green-400 font-mono flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Running…
          </div>
        ) : execResult ? (
          <pre className="px-4 py-3 text-xs font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto leading-relaxed">
            {execResult.stdout && <span className="text-gray-100">{execResult.stdout}</span>}
            {execResult.stderr && <span className="text-red-400">{execResult.stderr}</span>}
            {!execResult.stdout && !execResult.stderr && (
              <span className="text-gray-600">(no output)</span>
            )}
          </pre>
        ) : (
          <div className="px-4 py-3 text-xs text-gray-600 font-mono">
            Click <span className="text-gray-400">Run</span> to execute your code.
          </div>
        )}
      </div>
    </div>
  );
}
