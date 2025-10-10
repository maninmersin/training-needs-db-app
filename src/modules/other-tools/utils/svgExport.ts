import type { Plan, ExportOptions } from '../types';

interface SVGExportOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  excludeInteractiveElements?: boolean;
}

/**
 * Export timeline as SVG with PowerPoint-compatible structure
 */
export async function exportTimelineToSVG(
  plan: Plan, 
  options: ExportOptions & SVGExportOptions = { format: 'svg', includeTimeline: true, includeSwimlaneTitles: true, includeCardDescriptions: true, includeMilestones: true, colorScheme: 'default' }
): Promise<string> {
  
  // Get timeline container element (excludes toolbar and date controls)
  const timelineContainer = document.querySelector('.timeline-container') as HTMLElement;
  
  if (!timelineContainer) {
    throw new Error('Timeline container not found');
  }

  // Calculate container dimensions
  const rect = timelineContainer.getBoundingClientRect();
  const width = options.width || Math.max(rect.width, 1200);
  const height = options.height || Math.max(rect.height, 800);

  // Start building SVG
  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <style>
      .timeline-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .swimlane-title { font-weight: 600; font-size: 14px; }
      .card-title { font-weight: 500; font-size: 12px; }
      .timeline-grid { stroke: #e5e7eb; stroke-width: 1; fill: none; }
      .timeline-header { fill: #46566C; }
      .header-text { fill: white; font-weight: bold; font-size: 14px; }
    </style>
  </defs>`;

  // Add background
  svgContent += `\n  <rect width="100%" height="100%" fill="${options.backgroundColor || 'white'}"/>`;

  try {
    // Generate SVG from timeline components
    svgContent += await generateTimelineHeaderSVG(timelineContainer, plan, options);
    svgContent += await generateSwimlanesSVG(timelineContainer, plan, options);
    svgContent += await generateCardsSVG(timelineContainer, plan, options);
    
    if (options.includeMilestones) {
      svgContent += await generateMilestonesSVG(timelineContainer, plan, options);
    }
    
    // Add text and shape elements
    svgContent += await generateTextElementsSVG(timelineContainer, plan, options);
    svgContent += await generateShapeElementsSVG(timelineContainer, plan, options);
    
  } catch (error) {
    console.error('Error generating SVG content:', error);
    // Fallback to DOM-to-SVG conversion if component generation fails
    svgContent += await convertDOMToSVG(timelineContainer);
  }

  svgContent += '\n</svg>';
  
  return svgContent;
}

/**
 * Generate SVG for timeline header (year/month/week grid)
 */
async function generateTimelineHeaderSVG(container: HTMLElement, plan: Plan, options: ExportOptions): Promise<string> {
  const headerElement = container.querySelector('.timeline-header') as HTMLElement;
  if (!headerElement || !options.includeTimeline) return '';

  let headerSVG = '\n  <!-- Timeline Header -->\n  <g id="timeline-header">';

  // Get header dimensions and position
  const headerRect = headerElement.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const x = headerRect.left - containerRect.left;
  const y = headerRect.top - containerRect.top;

  // Header background
  headerSVG += `\n    <rect x="${x}" y="${y}" width="${headerRect.width}" height="${headerRect.height}" fill="#46566C"/>`;

  // Add year/month text elements from DOM
  const yearElements = headerElement.querySelectorAll('.year-row');
  const monthElements = headerElement.querySelectorAll('.month-row');

  yearElements.forEach((yearEl, index) => {
    const yearRect = yearEl.getBoundingClientRect();
    const yearX = yearRect.left - containerRect.left;
    const yearY = yearRect.top - containerRect.top + yearRect.height / 2 + 5;
    headerSVG += `\n    <text x="${yearX + 10}" y="${yearY}" class="timeline-text header-text">${yearEl.textContent || ''}</text>`;
  });

  monthElements.forEach((monthEl) => {
    const monthRect = monthEl.getBoundingClientRect();
    const monthX = monthRect.left - containerRect.left;
    const monthY = monthRect.top - containerRect.top + monthRect.height / 2 + 5;
    headerSVG += `\n    <text x="${monthX + 10}" y="${monthY}" class="timeline-text header-text">${monthEl.textContent || ''}</text>`;
  });

  headerSVG += '\n  </g>';
  return headerSVG;
}

/**
 * Generate SVG for swimlanes
 */
async function generateSwimlanesSVG(container: HTMLElement, plan: Plan, options: ExportOptions): Promise<string> {
  if (!options.includeSwimlaneTitles) return '';

  let swimlanesSVG = '\n  <!-- Swimlanes -->\n  <g id="swimlanes">';

  const swimlaneElements = container.querySelectorAll('.swimlane-row');
  const containerRect = container.getBoundingClientRect();

  swimlaneElements.forEach((swimlaneEl) => {
    const swimlaneRect = swimlaneEl.getBoundingClientRect();
    const x = swimlaneRect.left - containerRect.left;
    const y = swimlaneRect.top - containerRect.top;

    // Swimlane background
    swimlanesSVG += `\n    <rect x="${x}" y="${y}" width="${swimlaneRect.width}" height="${swimlaneRect.height}" fill="rgba(249, 250, 251, 0.5)" stroke="#e5e7eb"/>`;

    // Swimlane title
    const titleElement = swimlaneEl.querySelector('.swimlane-title');
    if (titleElement) {
      const titleRect = titleElement.getBoundingClientRect();
      const titleX = titleRect.left - containerRect.left + 10;
      const titleY = titleRect.top - containerRect.top + titleRect.height / 2 + 5;
      swimlanesSVG += `\n    <text x="${titleX}" y="${titleY}" class="timeline-text swimlane-title">${titleElement.textContent || ''}</text>`;
    }
  });

  swimlanesSVG += '\n  </g>';
  return swimlanesSVG;
}

/**
 * Generate SVG for timeline cards
 */
async function generateCardsSVG(container: HTMLElement, plan: Plan, options: ExportOptions): Promise<string> {
  let cardsSVG = '\n  <!-- Timeline Cards -->\n  <g id="cards">';

  const cardElements = container.querySelectorAll('.timeline-card');
  const containerRect = container.getBoundingClientRect();

  cardElements.forEach((cardEl) => {
    const cardRect = cardEl.getBoundingClientRect();
    const x = cardRect.left - containerRect.left;
    const y = cardRect.top - containerRect.top;

    // Get card styles
    const cardStyle = window.getComputedStyle(cardEl);
    const backgroundColor = cardStyle.backgroundColor || '#3B82F6';
    const borderRadius = '6';

    // Card rectangle
    cardsSVG += `\n    <rect x="${x}" y="${y}" width="${cardRect.width}" height="${cardRect.height}" fill="${backgroundColor}" rx="${borderRadius}" stroke="rgba(0,0,0,0.1)"/>`;

    // Card title
    const titleElement = cardEl.querySelector('.card-title');
    if (titleElement) {
      const titleRect = titleElement.getBoundingClientRect();
      const titleX = titleRect.left - containerRect.left + 8;
      const titleY = titleRect.top - containerRect.top + 18;
      cardsSVG += `\n    <text x="${titleX}" y="${titleY}" class="timeline-text card-title" fill="white">${titleElement.textContent || ''}</text>`;
    }

    // Card description if enabled
    if (options.includeCardDescriptions) {
      const descElement = cardEl.querySelector('.card-description');
      if (descElement) {
        const descRect = descElement.getBoundingClientRect();
        const descX = descRect.left - containerRect.left + 8;
        const descY = descRect.top - containerRect.top + 12;
        cardsSVG += `\n    <text x="${descX}" y="${descY}" class="timeline-text" font-size="10" fill="rgba(255,255,255,0.8)">${descElement.textContent || ''}</text>`;
      }
    }
  });

  cardsSVG += '\n  </g>';
  return cardsSVG;
}

/**
 * Generate SVG for milestones
 */
async function generateMilestonesSVG(container: HTMLElement, plan: Plan, options: ExportOptions): Promise<string> {
  let milestonesSVG = '\n  <!-- Milestones -->\n  <g id="milestones">';

  const milestoneElements = container.querySelectorAll('.milestone');
  const containerRect = container.getBoundingClientRect();

  milestoneElements.forEach((milestoneEl) => {
    const milestoneRect = milestoneEl.getBoundingClientRect();
    const centerX = milestoneRect.left - containerRect.left + milestoneRect.width / 2;
    const centerY = milestoneRect.top - containerRect.top + milestoneRect.height / 2;

    // Diamond shape for milestone
    const size = 12;
    const points = [
      [centerX, centerY - size],
      [centerX + size, centerY],
      [centerX, centerY + size],
      [centerX - size, centerY]
    ].map(p => p.join(',')).join(' ');

    milestonesSVG += `\n    <polygon points="${points}" fill="#F59E0B" stroke="#D97706" stroke-width="2"/>`;

    // Milestone label
    const labelElement = milestoneEl.querySelector('.milestone-label');
    if (labelElement) {
      milestonesSVG += `\n    <text x="${centerX}" y="${centerY + size + 15}" class="timeline-text" text-anchor="middle" font-size="11">${labelElement.textContent || ''}</text>`;
    }
  });

  milestonesSVG += '\n  </g>';
  return milestonesSVG;
}

/**
 * Generate SVG for text elements
 */
async function generateTextElementsSVG(container: HTMLElement, plan: Plan, options: ExportOptions): Promise<string> {
  let textSVG = '\n  <!-- Text Elements -->\n  <g id="text-elements">';

  const textElements = container.querySelectorAll('.text-element');
  const containerRect = container.getBoundingClientRect();

  textElements.forEach((textEl) => {
    const textRect = textEl.getBoundingClientRect();
    const x = textRect.left - containerRect.left;
    const y = textRect.top - containerRect.top + 16;

    const textStyle = window.getComputedStyle(textEl);
    const fontSize = textStyle.fontSize || '14px';
    const color = textStyle.color || '#000000';

    textSVG += `\n    <text x="${x}" y="${y}" class="timeline-text" font-size="${fontSize}" fill="${color}">${textEl.textContent || ''}</text>`;
  });

  textSVG += '\n  </g>';
  return textSVG;
}

/**
 * Generate SVG for shape elements
 */
async function generateShapeElementsSVG(container: HTMLElement, plan: Plan, options: ExportOptions): Promise<string> {
  let shapesSVG = '\n  <!-- Shape Elements -->\n  <g id="shape-elements">';

  // Add shapes based on plan.shapes data
  plan.shapes.forEach((shape) => {
    const x = shape.position.x;
    const y = shape.position.y;

    switch (shape.shapeType) {
      case 'rectangle':
        shapesSVG += `\n    <rect x="${x}" y="${y}" width="${shape.width || 100}" height="${shape.height || 60}" fill="${shape.color || '#E5E7EB'}" stroke="#9CA3AF"/>`;
        break;
      case 'circle':
        const radius = (shape.width || 80) / 2;
        shapesSVG += `\n    <circle cx="${x + radius}" cy="${y + radius}" r="${radius}" fill="${shape.color || '#E5E7EB'}" stroke="#9CA3AF"/>`;
        break;
      case 'line':
        shapesSVG += `\n    <line x1="${x}" y1="${y}" x2="${x + (shape.width || 100)}" y2="${y + (shape.height || 0)}" stroke="${shape.color || '#9CA3AF'}" stroke-width="2"/>`;
        break;
      case 'arrow':
        shapesSVG += `\n    <path d="M${x},${y} L${x + (shape.width || 100)},${y} L${x + (shape.width || 100) - 10},${y - 5} M${x + (shape.width || 100)},${y} L${x + (shape.width || 100) - 10},${y + 5}" stroke="${shape.color || '#9CA3AF'}" stroke-width="2" fill="none"/>`;
        break;
    }
  });

  shapesSVG += '\n  </g>';
  return shapesSVG;
}

/**
 * Fallback: Convert DOM element to SVG using html2canvas-like approach
 */
async function convertDOMToSVG(element: HTMLElement): Promise<string> {
  // This is a simplified fallback - in production you'd use a library like dom-to-svg
  return '\n  <!-- Fallback DOM conversion -->\n  <text x="50" y="50" class="timeline-text">SVG export in progress...</text>';
}

/**
 * Download SVG content as file
 */
export function downloadSVG(svgContent: string, filename: string = 'timeline.svg'): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Copy SVG to clipboard for direct paste into applications
 */
export async function copySVGToClipboard(svgContent: string): Promise<void> {
  try {
    // Try to copy as both text and blob for maximum compatibility
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([svgContent], { type: 'text/plain' }),
        'image/svg+xml': blob
      })
    ]);
    
    console.log('SVG copied to clipboard');
  } catch (error) {
    // Fallback to text copy
    await navigator.clipboard.writeText(svgContent);
    console.log('SVG copied to clipboard as text');
  }
}