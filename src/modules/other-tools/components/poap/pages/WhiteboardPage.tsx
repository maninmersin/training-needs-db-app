import { useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import LeftToolbar, { type ToolType } from '../components/LeftToolbar';
import TextBox from '../components/TextBox';
import type { TextElement } from '../types';

export default function WhiteboardPage() {
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [texts, setTexts] = useState<TextElement[]>([]);
  const [nextId, setNextId] = useState(1);

  const handleToolChange = (tool: ToolType) => {
    console.log('Tool changed to:', tool);
    setActiveTool(tool);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    console.log('Canvas clicked!', { activeTool });
    
    if (activeTool === 'text') {
      e.stopPropagation();
      e.preventDefault();
      
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      console.log('Creating text at position:', { x, y });
      
      const newText: TextElement = {
        id: `text-${nextId}`,
        planId: 'local-plan',
        content: 'Click to edit text',
        position: { x, y },
        size: { width: 200, height: 50 },
        style: {
          fontSize: 16,
          fontFamily: 'Arial, sans-serif',
          color: '#000000',
          backgroundColor: 'transparent',
          textAlign: 'left',
          fontWeight: 'normal',
          fontStyle: 'normal'
        },
        isSelected: false,
        isEditing: true,
        order: texts.length,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      setTexts(prev => [...prev, newText]);
      setNextId(prev => prev + 1);
      setActiveTool('select'); // Switch back to select tool
      console.log('Text created with ID:', newText.id);
    } else {
      // Clear selections when clicking elsewhere
      setTexts(prev => prev.map(text => ({ 
        ...text, 
        isSelected: false, 
        isEditing: false 
      })));
    }
  };

  const handleTextUpdate = (id: string, updates: Partial<TextElement>) => {
    console.log('Updating text:', id, updates);
    setTexts(prev => prev.map(text => 
      text.id === id ? { ...text, ...updates, updatedAt: new Date() } : text
    ));
  };

  const handleTextDelete = (id: string) => {
    console.log('Deleting text:', id);
    setTexts(prev => prev.filter(text => text.id !== id));
  };

  const handleTextSelect = (id: string | null) => {
    console.log('Selecting text:', id);
    setTexts(prev => prev.map(text => ({
      ...text,
      isSelected: text.id === id,
      isEditing: false
    })));
  };

  const handleTextStartEdit = (id: string) => {
    console.log('Start editing text:', id);
    setTexts(prev => prev.map(text => 
      text.id === id ? { ...text, isEditing: true, isSelected: false } : text
    ));
  };

  const handleTextFinishEdit = (id: string) => {
    console.log('Finish editing text:', id);
    setTexts(prev => prev.map(text => 
      text.id === id ? { ...text, isEditing: false, isSelected: true } : text
    ));
  };

  const handleCreateNew = () => {
    console.log('Create new plan clicked');
    // Clear existing texts for a fresh start
    setTexts([]);
    setNextId(1);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen flex bg-gray-50">
        {/* Left Toolbar */}
        <LeftToolbar 
          onCreateNew={handleCreateNew}
          activeTool={activeTool}
          onToolChange={handleToolChange}
        />
        
        {/* Main Canvas Area */}
        <div 
          className="flex-1 relative overflow-hidden cursor-crosshair"
          style={{ backgroundColor: '#F9FAFB' }}
          onClick={handleCanvasClick}
        >
          {/* Simple Grid Background */}
          <div 
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, #000 1px, transparent 1px),
                linear-gradient(to bottom, #000 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}
          />
          
          {/* Instructions */}
          <div className="absolute top-4 left-4 text-gray-600 text-sm pointer-events-none">
            <div>Select the Text tool (T) from the left toolbar</div>
            <div>Then click anywhere on this canvas to create text</div>
            <div>Double-click text to edit, drag to move</div>
          </div>

          {/* Text Elements */}
          {texts.map(textElement => (
            <TextBox
              key={textElement.id}
              textElement={textElement}
              onUpdate={handleTextUpdate}
              onDelete={handleTextDelete}
              onSelect={handleTextSelect}
              onStartEdit={handleTextStartEdit}
              onFinishEdit={handleTextFinishEdit}
            />
          ))}
        </div>
      </div>
    </DndProvider>
  );
}