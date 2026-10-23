import { checkFile } from '../styleRules';

describe('lint:styles rules', () => {
  test('a hard-coded colour in a component or stylesheet is a problem', () => {
    expect(checkFile('src/x/A.jsx', "const c = '#ff0000';")).toHaveLength(1);
    expect(checkFile('src/x/a.css', '.a { color: rgba(0,0,0,.5); }')).toHaveLength(1);
    expect(checkFile('src/x/a.css', '.a { background: hsl(10 50% 50%); }')).toHaveLength(1);
  });

  test('tokens, comments and ordinary text are fine', () => {
    expect(checkFile('src/x/a.css', '.a { color: var(--primary); }')).toEqual([]);
    expect(checkFile('src/x/A.jsx', '<div className="text-primary">#1 of 3</div>')).toEqual([]);
    expect(checkFile('src/x/a.css', '/* was #ff0000 */ .a { color: var(--border); }')).toEqual([]);
    expect(checkFile('src/x/A.js', '// old colour #fff\nconst a = 1;')).toEqual([]);
  });

  test('files where the colours are the data are allowed', () => {
    expect(checkFile('src/core/utils/colorUtils.js', "const c = '#e0e7ef';")).toEqual([]);
    expect(checkFile('src/styles/app.css', ':root { --primary: #2c4fd1; }')).toEqual([]);
  });

  test('tests and the UI kit page are not checked', () => {
    expect(checkFile('src/x/__tests__/a.test.js', "'#fff'")).toEqual([]);
    expect(checkFile('src/components/UiKit.jsx', "'#fff'")).toEqual([]);
  });

  test('a new inline style is a problem, a baseline one is not', () => {
    expect(checkFile('src/x/A.jsx', '<div style={{ width: 1 }} />')).toHaveLength(1);
    expect(checkFile('src/core/components/shell/AppShell.jsx', '<div style={{ width: 1 }} />')).toEqual([]);
    expect(checkFile('src/core/components/shell/AppShell.jsx', '<a style={{ a: 1 }} /><b style={{ a: 1 }} />')).toHaveLength(1);
  });
});
