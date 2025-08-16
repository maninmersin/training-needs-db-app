import React, { memo, useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';

const VirtualizedTable = memo(({ 
  data = [], 
  columns = [], 
  height = 400,
  itemHeight = 50,
  onRowClick,
  selectedRows = new Set(),
  className = '',
  loading = false,
  emptyMessage = 'No data available'
}) => {
  // Memoize the row data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    items: data,
    columns,
    onRowClick,
    selectedRows
  }), [data, columns, onRowClick, selectedRows]);

  // Row renderer component
  const Row = memo(({ index, style, data: itemData }) => {
    const { items, columns, onRowClick, selectedRows } = itemData;
    const item = items[index];
    const isSelected = selectedRows.has(item.id);

    const handleClick = useCallback(() => {
      if (onRowClick) {
        onRowClick(item, index);
      }
    }, [item, index]);

    return (
      <div 
        style={style}
        className={`virtual-table-row ${isSelected ? 'selected' : ''} ${index % 2 === 0 ? 'even' : 'odd'}`}
        onClick={handleClick}
      >
        {columns.map((column, colIndex) => (
          <div 
            key={column.key || colIndex}
            className="virtual-table-cell"
            style={{ 
              width: column.width || `${100 / columns.length}%`,
              minWidth: column.minWidth || '100px'
            }}
          >
            {column.render 
              ? column.render(item[column.key], item, index)
              : item[column.key]
            }
          </div>
        ))}
      </div>
    );
  });

  Row.displayName = 'VirtualizedTableRow';

  // Header component
  const TableHeader = memo(() => (
    <div className="virtual-table-header">
      {columns.map((column, index) => (
        <div 
          key={column.key || index}
          className="virtual-table-header-cell"
          style={{ 
            width: column.width || `${100 / columns.length}%`,
            minWidth: column.minWidth || '100px'
          }}
        >
          {column.title || column.key}
        </div>
      ))}
    </div>
  ));

  TableHeader.displayName = 'VirtualizedTableHeader';

  if (loading) {
    return (
      <div className={`virtual-table ${className}`}>
        <TableHeader />
        <div className="virtual-table-loading" style={{ height: height - 50 }}>
          <div className="loading-spinner"></div>
          <p>Loading data...</p>
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className={`virtual-table ${className}`}>
        <TableHeader />
        <div className="virtual-table-empty" style={{ height: height - 50 }}>
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`virtual-table ${className}`}>
      <TableHeader />
      <List
        height={height - 50} // Account for header height
        itemCount={data.length}
        itemSize={itemHeight}
        itemData={itemData}
        className="virtual-table-body"
      >
        {Row}
      </List>
    </div>
  );
});

VirtualizedTable.displayName = 'VirtualizedTable';

export default VirtualizedTable;