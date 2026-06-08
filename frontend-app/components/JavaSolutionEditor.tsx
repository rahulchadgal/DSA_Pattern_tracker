import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';

interface JavaSolutionEditorProps {
  themeMode: 'dark' | 'light';
  value: string;
  onChange: (value: string) => void;
}

const JavaSolutionEditor: React.FC<JavaSolutionEditorProps> = ({ themeMode, value, onChange }) => {
  const extensions = useMemo(() => [
    java(),
    EditorView.lineWrapping,
    EditorView.theme({
      '&': {
        minHeight: '55vh',
        height: '55vh',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: '13px',
        backgroundColor: themeMode === 'light' ? '#ffffff' : '#020617'
      },
      '.cm-scroller': {
        minHeight: '55vh',
        fontFamily: 'inherit'
      },
      '.cm-content': {
        padding: '16px'
      },
      '.cm-gutters': {
        backgroundColor: themeMode === 'light' ? '#f8fafc' : '#0f172a',
        borderRightColor: themeMode === 'light' ? '#e2e8f0' : '#334155'
      }
    })
  ], [themeMode]);

  return (
    <CodeMirror
      value={value}
      height="55vh"
      basicSetup={{
        autocompletion: true,
        bracketMatching: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
        lineNumbers: true
      }}
      extensions={extensions}
      theme={themeMode === 'dark' ? oneDark : 'light'}
      onChange={onChange}
    />
  );
};

export default JavaSolutionEditor;
