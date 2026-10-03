// Color utility functions for training sessions
export const COLOR_PALETTE = {
  default: {
    name: 'Cool Gray',
    backgroundColor: '#e0e7ef',
    textColor: '#2c3e50',
    borderColor: '#8ca0b3'
  },
  typeA: {
    name: 'Soft Blue',
    backgroundColor: '#cce5ff',
    textColor: '#1a365d',
    borderColor: '#8ca0b3'
  },
  typeB: {
    name: 'Sage Green',
    backgroundColor: '#d8e8dc',
    textColor: '#2d5a3d',
    borderColor: '#8ca0b3'
  },
  typeC: {
    name: 'Warm Peach',
    backgroundColor: '#ffe4d6',
    textColor: '#8b4513',
    borderColor: '#8ca0b3'
  },
  typeD: {
    name: 'Lavender',
    backgroundColor: '#e8e6f7',
    textColor: '#4a3a6b',
    borderColor: '#8ca0b3'
  },
  typeE: {
    name: 'Mint Green',
    backgroundColor: '#d6f5d6',
    textColor: '#2d5a2d',
    borderColor: '#8ca0b3'
  },
  typeF: {
    name: 'Dusty Rose',
    backgroundColor: '#f5d6d6',
    textColor: '#8b3a3a',
    borderColor: '#8ca0b3'
  },
  typeG: {
    name: 'Sky Blue',
    backgroundColor: '#d6e5f5',
    textColor: '#2d4a8b',
    borderColor: '#8ca0b3'
  },
  typeH: {
    name: 'Cream Yellow',
    backgroundColor: '#fff9e6',
    textColor: '#8b7d00',
    borderColor: '#8ca0b3'
  },
  typeI: {
    name: 'Soft Coral',
    backgroundColor: '#ffe6e6',
    textColor: '#8b2d2d',
    borderColor: '#8ca0b3'
  },
  typeJ: {
    name: 'Pale Teal',
    backgroundColor: '#d6f5f5',
    textColor: '#2d5a5a',
    borderColor: '#8ca0b3'
  },
  typeK: {
    name: 'Light Mauve',
    backgroundColor: '#f0e6f7',
    textColor: '#5a3a6b',
    borderColor: '#8ca0b3'
  },
  typeL: {
    name: 'Soft Sand',
    backgroundColor: '#f5f0e6',
    textColor: '#6b5a3a',
    borderColor: '#8ca0b3'
  }
};

// Hover/highlight effect color
export const HOVER_BORDER_COLOR = '#8ca0b3';

const COURSE_COLOR_TYPES = ['typeA', 'typeB', 'typeC', 'typeD', 'typeE', 'typeF', 'typeG', 'typeH', 'typeI', 'typeJ', 'typeK', 'typeL'];

// Course name a session should be coloured by (strips "- Group 1 (Part 1)" when only a title exists)
const courseNameOfSession = (session) => {
  const name = session?.course?.course_name;
  if (name) return name;
  const title = session?.title;
  return title ? title.replace(/\s*-\s*Group\s+\d+.*$/, '').trim() : null;
};

/**
 * Give every distinct course in a calendar its own color (until the palette runs out), assigned in
 * course-name order so the same schedule gets the same colors in the wizard preview and when reopened
 * from the database, and two courses never share a color just because their names hash alike.
 * @param {Array|Object} sessionsData - Flat session array, or nested functional_area -> location -> classroom -> [sessions]
 * @returns {Object} course name -> color object (pass to getColorByCourseTitle)
 */
export const buildCourseColorMapFromSessions = (sessionsData) => {
  const sessions = [];
  const collect = (node) => {
    if (Array.isArray(node)) node.forEach((item) => (item && item.start !== undefined ? sessions.push(item) : collect(item)));
    else if (node && typeof node === 'object') Object.values(node).forEach(collect);
  };
  collect(sessionsData);

  const courseNames = new Set();
  for (const session of sessions) {
    const name = courseNameOfSession(session);
    if (name) courseNames.add(name);
  }

  const colorMap = {};
  [...courseNames].sort((a, b) => a.localeCompare(b)).forEach((name, index) => {
    colorMap[name] = COLOR_PALETTE[COURSE_COLOR_TYPES[index % COURSE_COLOR_TYPES.length]];
  });
  return colorMap;
};

/**
 * Generates a consistent color assignment based on course title
 * @param {string} courseTitle - The course title
 * @param {Object} [colorMap] - Optional map from buildCourseColorMapFromSessions; guarantees distinct colors
 * @returns {object} Color object with backgroundColor, textColor, and borderColor
 */
export const getColorByCourseTitle = (courseTitle, colorMap) => {
  if (!courseTitle) {
    return COLOR_PALETTE.default;
  }

  if (colorMap && colorMap[courseTitle]) {
    return colorMap[courseTitle];
  }

  // Simple hash function to generate consistent color assignment
  let hash = 0;
  for (let i = 0; i < courseTitle.length; i++) {
    const char = courseTitle.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Get absolute value and map to color types
  const absHash = Math.abs(hash);
  const colorTypes = ['typeA', 'typeB', 'typeC', 'typeD', 'typeE', 'typeF', 'typeG', 'typeH', 'typeI', 'typeJ', 'typeK', 'typeL'];
  const colorIndex = absHash % colorTypes.length;
  
  return COLOR_PALETTE[colorTypes[colorIndex]];
};

/**
 * Get all available colors for the color palette selector
 * @returns {array} Array of color options
 */
export const getColorPaletteOptions = () => {
  return Object.entries(COLOR_PALETTE).map(([key, value]) => ({
    id: key,
    name: value.name,
    backgroundColor: value.backgroundColor,
    textColor: value.textColor,
    borderColor: value.borderColor
  }));
};

/**
 * Apply hover effect to a color
 * @param {object} color - Base color object
 * @returns {object} Color object with hover border
 */
export const applyHoverEffect = (color) => {
  return {
    ...color,
    borderColor: HOVER_BORDER_COLOR
  };
};

/**
 * Get contrast text color for better readability
 * @param {string} backgroundColor - Background color in hex format
 * @returns {string} Either '#000000' or '#ffffff' for best contrast
 */
export const getContrastTextColor = (backgroundColor) => {
  // Remove # if present
  const hex = backgroundColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#ffffff';
};