import React, { useState, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';
import './windows11-modal.css';

interface Windows11ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string | number;
  height?: string | number;
  maxWidth?: string | number;
  maxHeight?: string | number;
  isDraggable?: boolean;
  className?: string;
}

export default function Windows11Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = '700px',
  height = 'auto',
  maxWidth = '90vw',
  maxHeight = '90vh',
  isDraggable = true,
  className = ''
}: Windows11ModalProps) {
  
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [bounds, setBounds] = useState({ left: -400, top: -300, right: 400, bottom: 300 });
  const nodeRef = useRef(null);

  // Reset position and calculate bounds when modal opens
  useEffect(() => {
    if (isOpen) {
      // Calculate dynamic bounds based on window size
      const modalWidth = parseInt(typeof width === 'string' ? width : `${width}px`);
      
      // Handle height="auto" case - use estimated height
      let modalHeight;
      if (height === 'auto') {
        // For auto height, estimate based on content or use a reasonable default
        modalHeight = 600; // Default height for auto-sized modals
      } else {
        modalHeight = parseInt(typeof height === 'string' ? height : `${height}px`);
      }
      
      // Calculate center position - Draggable uses offset from center
      const centerX = 0; // Center horizontally
      const centerY = 0; // Center vertically
      
      // Set initial position to center
      setPosition({ x: centerX, y: centerY });
      
      // Allow dragging to 75% of screen in all directions
      const maxLeft = -(window.innerWidth * 0.75 - modalWidth / 2);
      const maxTop = -(window.innerHeight * 0.75 - modalHeight / 2);
      const maxRight = window.innerWidth * 0.75 - modalWidth / 2;
      const maxBottom = window.innerHeight * 0.75 - modalHeight / 2;
      
      setBounds({
        left: maxLeft,
        top: maxTop,
        right: maxRight,
        bottom: maxBottom
      });
    }
  }, [isOpen, width, height]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      ref={nodeRef}
      className={`bg-white/95 backdrop-blur-xl border border-gray-200/50 shadow-2xl rounded-xl overflow-hidden flex flex-col ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
        maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
        boxShadow: `
          0 32px 64px -8px rgba(0, 0, 0, 0.25),
          0 16px 32px -8px rgba(0, 0, 0, 0.15),
          0 8px 16px -4px rgba(0, 0, 0, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.1)
        `,
        backdropFilter: 'blur(20px) saturate(150%)',
        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)'
      }}
    >
      {/* Windows 11 Style Header */}
      <div 
        className={`windows11-modal-header modal-drag-handle border-b border-gray-200/30 bg-gradient-to-r from-white/20 to-gray-50/20 ${
          isDraggable ? 'cursor-move' : ''
        } select-none`}
        style={{
          background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.1) 0%, rgba(240, 242, 247, 0.1) 100%)'
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 tracking-tight">
            {title}
          </h2>
          <button
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-500/10 hover:text-red-600 transition-all duration-200 text-gray-500 cursor-pointer"
            aria-label="Close modal"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Modal Content */}
      <div 
        className="windows11-modal-body overflow-y-auto flex-1 min-h-0"
      >
        {children}
      </div>

      {/* Modal Footer */}
      {footer && (
        <div className="windows11-modal-footer border-t border-gray-200/30 bg-gray-50/30 flex items-center justify-end">
          {footer}
        </div>
      )}
    </div>
  );

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px) saturate(120%)',
        zIndex: 9999
      }}
      onClick={onClose}
    >
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          maxWidth: '90vw',
          maxHeight: '90vh',
          pointerEvents: 'auto'
        }}
      >
        {isDraggable ? (
          <Draggable
            nodeRef={nodeRef}
            handle=".modal-drag-handle"
            defaultPosition={{ x: 0, y: 0 }}
            bounds={{
              left: -window.innerWidth/2 + 100,
              right: window.innerWidth/2 - 100,
              top: -window.innerHeight/2 + 100,
              bottom: window.innerHeight/2 - 100
            }}
          >
            <div ref={nodeRef} onClick={(e) => e.stopPropagation()}>
              {modalContent}
            </div>
          </Draggable>
        ) : (
          <div onClick={(e) => e.stopPropagation()}>
            {modalContent}
          </div>
        )}
      </div>
    </div>
  );
}

// Reusable modal section components
export const ModalSection = ({ 
  title, 
  children, 
  className = '' 
}: { 
  title?: string; 
  children: React.ReactNode; 
  className?: string;
}) => (
  <div className={`space-y-4 ${className}`}>
    {title && (
      <h3 className="text-base font-semibold text-gray-800 border-b border-gray-200/50 pb-2">
        {title}
      </h3>
    )}
    {children}
  </div>
);

export const ModalGrid = ({ 
  children, 
  cols = 2, 
  className = '' 
}: { 
  children: React.ReactNode; 
  cols?: number; 
  className?: string;
}) => (
  <div className={`grid grid-cols-${cols} gap-4 ${className}`}>
    {children}
  </div>
);

export const ModalField = ({ 
  label, 
  children, 
  required = false, 
  error = '',
  className = ''
}: { 
  label: string; 
  children: React.ReactNode; 
  required?: boolean;
  error?: string;
  className?: string;
}) => (
  <div className={`space-y-2 ${className}`}>
    <label className="block text-sm font-medium text-gray-700">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {error && <p className="text-red-500 text-xs">{error}</p>}
  </div>
);


export const ModalBody = ({ 
  children, 
  className = '' 
}: { 
  children: React.ReactNode; 
  className?: string;
}) => (
  <div className={`space-y-8 ${className}`}>
    {children}
  </div>
);