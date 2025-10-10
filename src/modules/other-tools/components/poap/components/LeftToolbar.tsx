import React, { useState } from 'react';

export type ToolType = 'select' | 'text' | 'draw' | 'shape' | 'grid' | 'checklist' | 'alignment' | 'settings' | 'comment';

interface LeftToolbarProps {
  onCreateNew: () => void;
  onSave?: () => Promise<void>;
  activeTool?: ToolType;
  onToolChange?: (tool: ToolType) => void;
}

export default function LeftToolbar({ onCreateNew, onSave, activeTool = 'select', onToolChange }: LeftToolbarProps) {
  const ToolButton = ({ 
    icon, 
    label, 
    onClick,
    toolType,
    isActive = false
  }: { 
    icon: React.ReactNode; 
    label: string;
    onClick?: () => void;
    toolType?: ToolType;
    isActive?: boolean;
  }) => (
    <button
      onClick={() => {
        if (toolType && onToolChange) {
          console.log('Tool changed to:', toolType);
          onToolChange(toolType);
        }
        if (onClick) {
          onClick();
        }
      }}
      className={`w-12 h-12 flex items-center justify-center rounded-md transition-all ${
        isActive 
          ? 'bg-blue-600 text-white shadow-sm' 
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
      title={label}
    >
      {icon}
    </button>
  );

  return (
    <div className="w-16 bg-gray-50 border-r h-full flex flex-col items-center py-3 gap-1" style={{ borderColor: '#E5E5E5' }}>
      <ToolButton
        icon={
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672Zm-7.518-.267A8.25 8.25 0 1 1 20.25 10.5M8.288 14.212A5.25 5.25 0 1 1 17.25 10.5" />
          </svg>
        }
        label="Arrow tool (select)"
        toolType="select"
        isActive={activeTool === 'select'}
      />
      
      <ToolButton
        icon={
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
          </svg>
        }
        label="Grid/layout"
        toolType="grid"
        isActive={activeTool === 'grid'}
      />
      
      <ToolButton
        icon={
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        }
        label="Checklist/task"
        toolType="checklist"
        isActive={activeTool === 'checklist'}
      />
      
      <ToolButton
        icon={
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
        }
        label="Text tool (T)"
        toolType="text"
        isActive={activeTool === 'text'}
      />
      
      <ToolButton
        icon={
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        }
        label="Alignment/arrangement"
        toolType="alignment"
        isActive={activeTool === 'alignment'}
      />
      
      <ToolButton
        icon={
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        }
        label="Pen/drawing"
        toolType="draw"
        isActive={activeTool === 'draw'}
      />
      
      <ToolButton
        icon={
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth={1.5} fill="none" />
          </svg>
        }
        label="Shape tool (square with +)"
        toolType="shape"
        isActive={activeTool === 'shape'}
      />
      
      <ToolButton
        icon={
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
        }
        label="Globe (settings/global)"
        toolType="settings"
        isActive={activeTool === 'settings'}
      />
      
      <ToolButton
        icon={
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
        }
        label="Chat/comment bubble"
        toolType="comment"
        isActive={activeTool === 'comment'}
      />
      
      <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors">
        <svg width="24" height="24" className="text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </div>

      <div className="flex-1"></div>
      
      <div className="flex flex-col gap-1">
        <ToolButton
          icon={
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
            </svg>
          }
          label="Undo"
        />
        
        <ToolButton
          icon={
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
            </svg>
          }
          label="Redo"
        />
      </div>
    </div>
  );
}