// Wraps every existing component stylesheet in `@layer legacy` so the new Tailwind utilities and
// ui components (declared later in the layer order, see src/styles/app.css) always win over old CSS.
// Stylesheets that override third-party CSS (FullCalendar `.fc-*`, react-pivottable `.pvt*`) stay
// unlayered until those screens are redone, otherwise the library's own CSS would win.
import path from 'node:path';
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

const legacyLayer = () => ({
  postcssPlugin: 'legacy-layer',
  Once(root, { AtRule }) {
    const file = (root.source?.input.file || '').split(path.sep).join('/');
    if (!file.endsWith('.css') || !file.includes('/src/') || file.includes('/src/styles/')) return;

    let overridesLibrary = false;
    root.walkRules((rule) => {
      if (/\.fc-|\.pvt/.test(rule.selector)) overridesLibrary = true;
    });
    if (overridesLibrary) return;

    const body = [];
    root.each((node) => {
      const isHead = node.type === 'atrule' && (node.name === 'import' || node.name === 'charset');
      if (!isHead) body.push(node);
    });
    if (!body.length) return;

    const layer = new AtRule({ name: 'layer', params: 'legacy' });
    body.forEach((node) => {
      node.remove();
      layer.append(node);
    });
    root.append(layer);
  }
});
legacyLayer.postcss = true;

export default {
  plugins: [legacyLayer(), tailwindcss(), autoprefixer()]
};
