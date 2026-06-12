import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';

interface JavaSolutionEditorProps {
  themeMode: 'dark' | 'light';
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  height?: string;
}

const JavaSolutionEditor: React.FC<JavaSolutionEditorProps> = ({
  themeMode,
  value,
  onChange,
  readOnly = false,
  height = '55vh'
}) => {
  const extensions = useMemo(() => [
    java(),
    EditorView.lineWrapping,
    ...(readOnly ? [EditorView.editable.of(false)] : []),
    EditorView.theme({
      '&': {
        minHeight: height,
        height,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: '13px',
        backgroundColor: 'rgba(8, 18, 41, 0.72)'
      },
      '.cm-scroller': {
        minHeight: height,
        fontFamily: 'inherit'
      },
      '.cm-content': {
        padding: '16px'
      },
      '.cm-line': {
        caretColor: readOnly ? 'transparent' : 'auto'
      },
      '.cm-gutters': {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRightColor: 'rgba(255, 255, 255, 0.12)',
        color: '#94A3B8'
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'rgba(168, 85, 247, 0.14)'
      },
      '.cm-activeLine': {
        backgroundColor: readOnly ? 'transparent' : 'rgba(168, 85, 247, 0.08)'
      }
    })
  ], [height, readOnly, themeMode]);

  return (
    <CodeMirror
      value={value}
      height={height}
      basicSetup={{
        autocompletion: !readOnly,
        bracketMatching: true,
        foldGutter: true,
        highlightActiveLine: !readOnly,
        highlightSelectionMatches: true,
        lineNumbers: true
      }}
      extensions={extensions}
      editable={!readOnly}
      theme={themeMode === 'dark' ? oneDark : 'light'}
      onChange={readOnly ? undefined : onChange}
    />
  );
};

export default JavaSolutionEditor;
