import { useState, useEffect } from 'react';
import type { Swimlane, MilestoneData } from '../types';
import { usePlanStore } from '../state/usePlanStore';
import Windows11Modal, { ModalBody, ModalSection, ModalGrid, ModalField } from './ui/Windows11Modal';

interface CategoryEditorModalProps {
  isOpen: boolean;
  swimlane: Swimlane | null;
  onSave: (updates: Partial<Swimlane>) => void;
  onCancel: () => void;
}

export default function CategoryEditorModal({ 
  isOpen, 
  swimlane, 
  onSave, 
  onCancel 
}: CategoryEditorModalProps) {
  // Access the current plan and store methods
  const { currentPlan, addSubCategory, updateSwimlane, deleteSwimlane } = usePlanStore();
  
  // Main category form state
  const [title, setTitle] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#4A90A4');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [fontSize, setFontSize] = useState(16);
  const [fontWeight, setFontWeight] = useState<'normal' | 'medium' | 'semibold' | 'bold'>('bold');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [color, setColor] = useState('#4A90A4');
  const [isMainCategory, setIsMainCategory] = useState(false);
  const [parentId, setParentId] = useState<string>('');

  // Milestone state
  const [hasMilestone, setHasMilestone] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [milestoneColor, setMilestoneColor] = useState('#F59E0B');

  // Sub-category management state
  const [editingSubCategory, setEditingSubCategory] = useState<Swimlane | null>(null);
  const [newSubCategoryTitle, setNewSubCategoryTitle] = useState('');
  const [subCategoryFormData, setSubCategoryFormData] = useState({
    title: '',
    backgroundColor: '#E1F1F5',
    textColor: '#2C5F6B',
    fontSize: 14,
    fontWeight: 'medium' as 'normal' | 'medium' | 'semibold' | 'bold',
    fontFamily: 'Inter'
  });

  // Predefined color options
  const colorOptions = [
    { name: 'Blue', value: '#4A90A4' },
    { name: 'Gray', value: '#666666' },
    { name: 'Green', value: '#5C8A5C' },
    { name: 'Purple', value: '#7C3AED' },
    { name: 'Red', value: '#DC2626' },
    { name: 'Orange', value: '#EA580C' },
    { name: 'Teal', value: '#0D9488' },
    { name: 'Pink', value: '#DB2777' }
  ];

  const milestoneColorOptions = [
    { name: 'Amber', value: '#F59E0B' },
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Gray', value: '#6B7280' },
    { name: 'Teal', value: '#14B8A6' }
  ];

  const textColorOptions = [
    { name: 'White', value: '#FFFFFF' },
    { name: 'Black', value: '#000000' },
    { name: 'Dark Gray', value: '#374151' },
    { name: 'Light Gray', value: '#9CA3AF' }
  ];

  // Sub-category specific color options (lighter, complementary colors)
  const subCategoryColorOptions = [
    { name: 'Light Blue', value: '#E1F1F5', textColor: '#2C5F6B' },
    { name: 'Light Green', value: '#E8F5E8', textColor: '#2D5A2D' },
    { name: 'Light Purple', value: '#F0E7FF', textColor: '#4C1D95' },
    { name: 'Light Orange', value: '#FFF3E0', textColor: '#E65100' },
    { name: 'Light Red', value: '#FFEBEE', textColor: '#C62828' },
    { name: 'Light Teal', value: '#E0F2F1', textColor: '#00695C' },
    { name: 'Light Pink', value: '#FCE4EC', textColor: '#AD1457' },
    { name: 'Light Gray', value: '#F5F5F5', textColor: '#424242' }
  ];

  const fontOptions = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Arial', label: 'Arial' },
    { value: 'system-ui', label: 'System UI' },
    { value: 'Helvetica Neue', label: 'Helvetica Neue' }
  ];

  const fontWeightOptions = [
    { value: 'normal' as const, label: 'Normal' },
    { value: 'medium' as const, label: 'Medium' },
    { value: 'semibold' as const, label: 'Semi-Bold' },
    { value: 'bold' as const, label: 'Bold' }
  ];

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && swimlane) {
      setTitle(swimlane.title);
      setBackgroundColor(swimlane.backgroundColor || '#4A90A4');
      setTextColor(swimlane.textColor || '#FFFFFF');
      setFontSize(swimlane.fontSize || 16);
      setFontWeight(swimlane.fontWeight || 'bold');
      setFontFamily(swimlane.fontFamily || 'Inter');
      setColor(swimlane.color || '#4A90A4');
      setIsMainCategory(swimlane.isMainCategory || false);
      setParentId(swimlane.parentId || '');
      
      // Initialize milestone data
      if (swimlane.milestone) {
        setHasMilestone(true);
        setMilestoneTitle(swimlane.milestone.title);
        setMilestoneDate(swimlane.milestone.date.toISOString().split('T')[0]);
        setMilestoneColor(swimlane.milestone.color);
      } else {
        setHasMilestone(false);
        setMilestoneTitle('');
        setMilestoneDate(new Date().toISOString().split('T')[0]);
        setMilestoneColor('#F59E0B');
      }
    } else if (isOpen && !swimlane) {
      // Default values for new category
      setTitle('New Category');
      setBackgroundColor('#4A90A4');
      setTextColor('#FFFFFF');
      setFontSize(16);
      setFontWeight('bold');
      setFontFamily('Inter');
      setColor('#4A90A4');
      setIsMainCategory(false);
      setParentId('');
      setHasMilestone(false);
      setMilestoneTitle('');
      setMilestoneDate(new Date().toISOString().split('T')[0]);
      setMilestoneColor('#F59E0B');
    }
  }, [isOpen, swimlane]);

  // Handle save
  const handleSave = () => {
    if (!title.trim()) return;

    // Prepare milestone data
    let milestoneData: MilestoneData | undefined = undefined;
    if (hasMilestone && milestoneTitle.trim()) {
      milestoneData = {
        title: milestoneTitle.trim(),
        date: new Date(milestoneDate),
        color: milestoneColor
      };
    }

    const updates: Partial<Swimlane> = {
      title: title.trim(),
      backgroundColor,
      textColor,
      fontSize,
      fontWeight,
      fontFamily,
      color,
      isMainCategory,
      parentId: isMainCategory ? undefined : (parentId || undefined),
      level: isMainCategory ? 0 : 1,
      hasChildren: isMainCategory,
      milestone: milestoneData
    };

    onSave(updates);
  };

  // Get available parent categories (main categories only) - for future use
  // const availableParents = currentPlan?.swimlanes
  //   .filter(s => s.isMainCategory && s.id !== swimlane?.id)
  //   .sort((a, b) => a.order - b.order) || [];

  // Get sub-categories for current main category
  const subCategories = currentPlan?.swimlanes
    .filter(s => s.parentId === swimlane?.id)
    .sort((a, b) => a.order - b.order) || [];

  // Sub-category management functions
  const handleAddSubCategory = () => {
    if (!swimlane?.id || !newSubCategoryTitle.trim()) return;
    
    addSubCategory(swimlane.id, newSubCategoryTitle.trim());
    setNewSubCategoryTitle('');
  };

  const handleEditSubCategory = (subCategory: Swimlane) => {
    setEditingSubCategory(subCategory);
    setSubCategoryFormData({
      title: subCategory.title,
      backgroundColor: subCategory.backgroundColor || '#E1F1F5',
      textColor: subCategory.textColor || '#2C5F6B',
      fontSize: subCategory.fontSize || 14,
      fontWeight: (subCategory.fontWeight as 'normal' | 'medium' | 'semibold' | 'bold') || 'medium',
      fontFamily: subCategory.fontFamily || 'Inter'
    });
  };

  const handleSaveSubCategory = () => {
    if (!editingSubCategory) return;
    
    updateSwimlane(editingSubCategory.id, subCategoryFormData);
    setEditingSubCategory(null);
  };

  const handleDeleteSubCategory = (subCategoryId: string) => {
    if (confirm('Are you sure you want to delete this sub-category? All associated cards and milestones will be removed.')) {
      deleteSwimlane(subCategoryId);
    }
  };

  const resetSubCategoryForm = () => {
    setSubCategoryFormData({
      title: '',
      backgroundColor: '#E1F1F5',
      textColor: '#2C5F6B',
      fontSize: 14,
      fontWeight: 'medium',
      fontFamily: 'Inter'
    });
    setEditingSubCategory(null);
  };

  const footerContent = (
    <>
      <button
        onClick={onCancel}
        className="px-6 py-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={handleSave}
        disabled={!title.trim()}
        className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
      >
        Save Changes
      </button>
    </>
  );

  return (
    <Windows11Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={swimlane?.isMainCategory ? 'Manage Main Category' : 'Edit Category'}
      width="670px"
      maxHeight="95vh"
      footer={footerContent}
    >
      <ModalBody>
        {/* Basic Information Section */}
        <ModalSection title="Basic Information">
          <ModalField label="Category Title" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Category name..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
            />
            {!title.trim() && (
              <p className="text-red-500 text-xs mt-1">Title is required</p>
            )}
          </ModalField>
        </ModalSection>

        {/* Sub-Category Management - Only show for main categories */}
        {swimlane?.isMainCategory && (
          <ModalSection title="Sub-Category Management">
            {/* Add New Sub-Category */}
            <div className="bg-green-50/50 p-6 rounded-lg border border-green-200/50">
              <h4 className="font-semibold text-gray-700 mb-3">Add New Sub-Category</h4>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Sub-category name..."
                  value={newSubCategoryTitle}
                  onChange={(e) => setNewSubCategoryTitle(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSubCategory()}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
                <button 
                  onClick={handleAddSubCategory} 
                  disabled={!newSubCategoryTitle.trim()}
                  className="px-6 py-3 bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm whitespace-nowrap"
                >
                  Add Sub-Category
                </button>
              </div>
            </div>

            {/* Existing Sub-Categories List */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-700">Existing Sub-Categories ({subCategories.length})</h4>
              {subCategories.length === 0 ? (
                <p className="text-gray-500 italic py-6 text-center border border-dashed border-gray-300 rounded-lg bg-gray-50/30">
                  No sub-categories yet. Add one above to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {subCategories.map((subCategory) => (
                    <div 
                      key={subCategory.id} 
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-5 h-5 rounded"
                          style={{ backgroundColor: subCategory.backgroundColor }}
                          title={`Background: ${subCategory.backgroundColor}`}
                        />
                        <div>
                          <div className="font-medium text-gray-900">{subCategory.title}</div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditSubCategory(subCategory)}
                          className="px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200 hover:border-blue-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSubCategory(subCategory.id)}
                          className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-red-200 hover:border-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sub-Category Edit Form - Show when editing a sub-category */}
            {editingSubCategory && (
              <div className="bg-orange-50/70 p-6 rounded-lg border-l-4 border-orange-400">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-800">
                    Editing Sub-Category: {editingSubCategory.title}
                  </h4>
                  <button 
                    onClick={resetSubCategoryForm} 
                    className="px-4 py-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                  >
                    Cancel
                  </button>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow-sm border border-orange-200 space-y-4">
                  {/* Sub-category Basic Info */}
                  <ModalField label="Sub-Category Title">
                    <input
                      type="text"
                      value={subCategoryFormData.title}
                      onChange={(e) => setSubCategoryFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Sub-category name..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                    />
                  </ModalField>

                  {/* Sub-category Color Theme */}
                  <ModalField label="Choose Color Theme">
                    <p className="text-xs text-gray-500 mb-3">Select a complementary color theme for this sub-category</p>
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      {subCategoryColorOptions.map((colorOption) => (
                        <button
                          key={colorOption.value}
                          onClick={() => setSubCategoryFormData(prev => ({ 
                            ...prev, 
                            backgroundColor: colorOption.value,
                            textColor: colorOption.textColor 
                          }))}
                          className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                            subCategoryFormData.backgroundColor === colorOption.value 
                              ? 'border-blue-500 shadow-md' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          style={{ 
                            backgroundColor: colorOption.value,
                            color: colorOption.textColor
                          }}
                        >
                          <div className="text-xs font-medium">{colorOption.name}</div>
                          <div className="text-xs opacity-75 mt-1">Sample</div>
                        </button>
                      ))}
                    </div>
                  </ModalField>

                  <ModalGrid cols={2}>
                    <ModalField label="Font Weight">
                      <select
                        value={subCategoryFormData.fontWeight}
                        onChange={(e) => setSubCategoryFormData(prev => ({ ...prev, fontWeight: e.target.value as 'normal' | 'medium' | 'semibold' | 'bold' }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white"
                      >
                        {fontWeightOptions.map((weight) => (
                          <option key={weight.value} value={weight.value}>{weight.label}</option>
                        ))}
                      </select>
                    </ModalField>

                    <ModalField label={`Font Size: ${subCategoryFormData.fontSize}px`}>
                      <div className="space-y-2">
                        <input
                          type="number"
                          value={subCategoryFormData.fontSize}
                          onChange={(e) => setSubCategoryFormData(prev => ({ ...prev, fontSize: Number(e.target.value) }))}
                          min="10"
                          max="18"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                        />
                        <input
                          type="range"
                          min="10"
                          max="18"
                          value={subCategoryFormData.fontSize}
                          onChange={(e) => setSubCategoryFormData(prev => ({ ...prev, fontSize: Number(e.target.value) }))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                    </ModalField>
                  </ModalGrid>

                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    <button 
                      onClick={resetSubCategoryForm}
                      className="px-4 py-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveSubCategory}
                      className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                    >
                      Save Sub-Category
                    </button>
                  </div>
                </div>
              </div>
            )}
          </ModalSection>
        )}

        {/* Main Category Appearance */}
        <ModalSection title={swimlane?.isMainCategory ? 'Main Category Styling' : 'Category Styling'}>
          {swimlane?.isMainCategory && (
            <p className="text-sm text-gray-600 mb-4">
              Configure the bold, prominent styling for this main category header
            </p>
          )}
          
          <ModalGrid cols={2}>
            <ModalField label="Background Color">
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setBackgroundColor(color.value)}
                      className={`w-full h-8 rounded-md border-2 transition-all hover:scale-105 ${
                        backgroundColor === color.value ? 'border-blue-500 shadow-md' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-full h-8 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>
            </ModalField>

            <ModalField label="Text Color">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {textColorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setTextColor(color.value)}
                      className={`w-full h-8 rounded-md border-2 transition-all hover:scale-105 ${
                        textColor === color.value ? 'border-blue-500 shadow-md' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-full h-8 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>
            </ModalField>
          </ModalGrid>

          <ModalGrid cols={3}>
            <ModalField label="Font Family">
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white"
              >
                {fontOptions.map((font) => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
            </ModalField>

            <ModalField label="Font Weight">
              <select
                value={fontWeight}
                onChange={(e) => setFontWeight(e.target.value as 'normal' | 'medium' | 'semibold' | 'bold')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors bg-white"
              >
                {fontWeightOptions.map((weight) => (
                  <option key={weight.value} value={weight.value}>{weight.label}</option>
                ))}
              </select>
            </ModalField>

            <ModalField label={`Font Size: ${fontSize}px`}>
              <div className="space-y-2">
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  min="12"
                  max="24"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                />
                <input
                  type="range"
                  min="12"
                  max="24"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </ModalField>
          </ModalGrid>
        </ModalSection>

        {/* Milestone Section */}
        <ModalSection title="Swimlane Milestone">
          <div className="flex items-center space-x-3 mb-4">
            <input
              type="checkbox"
              id="hasMilestone"
              checked={hasMilestone}
              onChange={(e) => setHasMilestone(e.target.checked)}
              className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="hasMilestone" className="text-sm font-medium text-gray-700">
              Add milestone to this swimlane
            </label>
          </div>

          {hasMilestone && (
            <div className="space-y-4 bg-amber-50/50 p-6 rounded-lg border border-amber-200/50">
              <ModalGrid cols={2}>
                <ModalField label="Milestone Title">
                  <input
                    type="text"
                    value={milestoneTitle}
                    onChange={(e) => setMilestoneTitle(e.target.value)}
                    placeholder="Enter milestone name..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                </ModalField>

                <ModalField label="Milestone Date">
                  <input
                    type="date"
                    value={milestoneDate}
                    onChange={(e) => setMilestoneDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                  />
                </ModalField>
              </ModalGrid>

              <ModalField label="Milestone Color">
                <div className="space-y-3">
                  <div className="grid grid-cols-8 gap-2">
                    {milestoneColorOptions.map((colorOption) => (
                      <button
                        key={colorOption.value}
                        type="button"
                        onClick={() => setMilestoneColor(colorOption.value)}
                        className={`w-full h-8 rounded-md border-2 transition-all hover:scale-105 ${
                          milestoneColor === colorOption.value ? 'border-blue-500 shadow-md' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: colorOption.value }}
                        title={colorOption.name}
                      />
                    ))}
                  </div>
                  
                  <input
                    type="color"
                    value={milestoneColor}
                    onChange={(e) => setMilestoneColor(e.target.value)}
                    className="w-full h-8 border border-gray-300 rounded-lg cursor-pointer"
                  />
                </div>
              </ModalField>

              {/* Milestone Preview */}
              <ModalField label="Preview">
                <div className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: milestoneColor }}
                  />
                  <span className="text-sm text-gray-700">
                    {milestoneTitle || 'Milestone Title'}
                  </span>
                </div>
              </ModalField>
            </div>
          )}
        </ModalSection>
      </ModalBody>
    </Windows11Modal>
  );
}