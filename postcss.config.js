// Tailwind v4 and autoprefixer. (Until Phase 7 a step here wrapped the old component CSS in a low-priority
// layer; all of that CSS is gone, so it was removed.)
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

export default {
  plugins: [tailwindcss(), autoprefixer()]
};
