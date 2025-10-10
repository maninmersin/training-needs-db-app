import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

interface TopToolbarProps {
  onAddCard: () => void;
  onAddSwimlane: () => void;
  onAddMilestone: () => void;
  onAddText?: () => void;
  onAddShape?: () => void;
  onSave?: () => Promise<void>;
  onSaveAs?: () => void;
  onExport?: () => void;
  onHome?: () => void;
}

export default function TopToolbar({ onAddCard, onAddSwimlane, onAddMilestone, onAddText, onAddShape, onSave, onSaveAs, onExport, onHome }: TopToolbarProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="flex items-center" style={{ gap: '2rem' }}>
      {/* Navigation & File Management Group */}
      {(onHome || onSave || onSaveAs || onExport) && (
        <div className="flex items-center gap-2" style={{ 
          padding: '8px 12px', 
          border: '1px solid #e5e7eb', 
          borderRadius: '8px', 
          backgroundColor: 'rgba(249, 250, 251, 0.8)' 
        }}>
          {onHome && (
            <Button 
              onClick={onHome}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-300"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9,22 9,12 15,12 15,22"/>
              </svg>
              Home
            </Button>
          )}
          
          {onSave && (
            <Button 
              onClick={handleSave}
              disabled={isSaving}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 hover:bg-emerald-50 hover:border-emerald-300"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17,21 17,13 7,13 7,21"/>
                <polyline points="7,3 7,8 15,8"/>
              </svg>
              {isSaving ? 'Saving...' : 'Save Plan'}
            </Button>
          )}
          
          {onSaveAs && (
            <Button 
              onClick={onSaveAs}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 hover:bg-teal-50 hover:border-teal-300"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17,21 17,13 7,13 7,21"/>
                <polyline points="7,3 7,8 15,8"/>
                <path d="M12 12l4-4m0 0l-4-4m4 4H4"/>
              </svg>
              Save As
            </Button>
          )}
          
          {onExport && (
            <Button 
              onClick={onExport}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 hover:bg-purple-50 hover:border-purple-300"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export
            </Button>
          )}
        </div>
      )}
      
      {/* Content Creation Group */}
      <div className="flex items-center gap-2" style={{ 
        padding: '8px 12px', 
        border: '1px solid #bfdbfe', 
        borderRadius: '8px', 
        backgroundColor: 'rgba(239, 246, 255, 0.8)' 
      }}>
        <Button 
          onClick={onAddCard}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 hover:bg-blue-50 hover:border-blue-300"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Add Card
        </Button>

        <Button 
          onClick={onAddSwimlane}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 hover:bg-green-50 hover:border-green-300"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path d="M3 6h18"/>
            <path d="M3 12h18"/>
            <path d="M3 18h18"/>
          </svg>
          Add Main Category
        </Button>

        <Button 
          onClick={onAddMilestone}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 hover:bg-amber-50 hover:border-amber-300"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <polygon points="12,2 15.09,8.26 22,9 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9 8.91,8.26"/>
          </svg>
          Add Milestone
        </Button>

        {onAddText && (
          <Button 
            onClick={onAddText}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 hover:bg-purple-50 hover:border-purple-300"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
            Add Text
          </Button>
        )}

        {onAddShape && (
          <Button 
            onClick={onAddShape}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 hover:bg-orange-50 hover:border-orange-300"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="12" cy="12" r="4"/>
              <path d="M16 8l-4 4 4 4"/>
            </svg>
            Add Shape
          </Button>
        )}
      </div>
    </div>
  );
}