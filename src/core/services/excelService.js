/**
 * Dynamic Excel Service - Loads XLSX library only when needed
 * This reduces the main bundle size by ~424 kB
 */

export const ExcelService = {
  /**
   * Dynamically import and read Excel file
   */
  async readWorkbook(file) {
    const XLSX = await import('xlsx');
    const arrayBuffer = await file.arrayBuffer();
    return XLSX.read(arrayBuffer, { type: 'array' });
  },

  /**
   * Dynamically import and export data to Excel
   */
  async exportWorkbook(data, filename = 'export.xlsx', options = {}) {
    const XLSX = await import('xlsx');
    
    const worksheet = XLSX.utils.json_to_sheet(data, options);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName || 'Sheet1');
    
    XLSX.writeFile(workbook, filename);
  },

  /**
   * Convert worksheet to JSON with dynamic import
   */
  async worksheetToJson(worksheet, options = {}) {
    const XLSX = await import('xlsx');
    return XLSX.utils.sheet_to_json(worksheet, options);
  },

  /**
   * Get worksheet names from workbook
   */
  getSheetNames(workbook) {
    return workbook.SheetNames;
  },

  /**
   * Get specific worksheet from workbook
   */
  getWorksheet(workbook, sheetName) {
    return workbook.Sheets[sheetName];
  }
};