// React Singleton to prevent forwardRef issues
import React from 'react';
import ReactDOM from 'react-dom';

// Create enhanced React with better forwardRef handling
const EnhancedReact = new Proxy(React, {
  get: function(target, property, receiver) {
    if (property === 'forwardRef') {
      console.log('Real React forwardRef accessed');
      return target.forwardRef;
    }
    return target[property];
  }
});

// Aggressively override any stubs with the real React
window.React = EnhancedReact;
window.ReactDOM = ReactDOM;
globalThis.React = EnhancedReact;
globalThis.ReactDOM = ReactDOM;

// Ensure all React methods are available globally
Object.keys(React).forEach(key => {
  if (typeof React[key] === 'function') {
    window[key] = React[key];
    globalThis[key] = React[key];
  }
});

// Specifically ensure forwardRef is available everywhere
window.forwardRef = React.forwardRef;
globalThis.forwardRef = React.forwardRef;
if (typeof global !== 'undefined') {
  global.React = EnhancedReact;
  global.forwardRef = React.forwardRef;
}

// Force override any existing React references in module cache
try {
  const moduleCache = window.__viteCache || window.__webpackModuleCache;
  if (moduleCache) {
    Object.keys(moduleCache).forEach(key => {
      if (key.includes('react') && moduleCache[key]?.exports?.forwardRef) {
        console.log('Patching cached React module:', key);
        moduleCache[key].exports = EnhancedReact;
      }
    });
  }
} catch (e) {
  console.warn('Could not patch module cache:', e);
}

// Create a console message to confirm React singleton loaded
console.log('Enhanced React singleton loaded:', {
  hasReact: !!window.React,
  hasForwardRef: !!window.React?.forwardRef,
  forwardRefType: typeof window.React?.forwardRef,
  reactKeys: Object.keys(React)
});

export { React as default, ReactDOM };
export * from 'react';