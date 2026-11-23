// Muat Monaco dari node_modules (bukan CDN) supaya jalan offline.
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import TsWorker from "monaco-editor/language/typescript/ts.worker?worker";

self.MonacoEnvironment = {
  getWorker: (_id, label) =>
    label === "typescript" || label === "javascript" ? new TsWorker() : new EditorWorker(),
};

const ts = monaco.typescript;
ts.typescriptDefaults.setCompilerOptions({
  jsx: ts.JsxEmit.React,
  target: ts.ScriptTarget.ES2020,
  allowNonTsExtensions: true,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
});
// Tanpa type definitions remotion, matikan error semantik agar tidak penuh garis merah.
ts.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });

loader.config({ monaco });
