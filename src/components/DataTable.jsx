import React, { useState, useMemo } from 'react';
import * as Papa from 'papaparse';
import { Database, ChevronDown, Search, Download, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';

const DataTable = ({ filteredData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const tableHeaders = [
    { key: 'EMPLOYER_NAME', label: 'Employer Name' },
    { key: 'SOC_NAME', label: 'SOC Name' },
    { key: 'JOB_TITLE', label: 'Job Title' },
    { key: 'PREVAILING_WAGE', label: 'Prevailing Wage' },
    { key: 'YEAR', label: 'Year' },
    { key: 'CITY', label: 'City' },
    { key: 'STATE', label: 'State' }
  ];

  // Reset page when search or data changes
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleSort = (colKey) => {
    if (sortColumn === colKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colKey);
      setSortDirection('asc');
    }
    setPage(1);
  };

  // Process data locally (Filter -> Sort -> Paginate)
  const processedData = useMemo(() => {
    if (!filteredData) return { total: 0, items: [] };
    if (!isOpen) {
      return { total: filteredData.length, items: [] };
    }

    let result = [...filteredData];

    // 1. Filter
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter(row => {
        return tableHeaders.some(h => {
          const val = row[h.key];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(query);
        });
      });
    }

    // 2. Sort
    if (sortColumn) {
      result.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        
        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';

        if (sortColumn === 'PREVAILING_WAGE' || sortColumn === 'YEAR') {
          const numA = Number(valA);
          const numB = Number(valB);
          if (!isNaN(numA) && !isNaN(numB)) {
            return sortDirection === 'asc' ? numA - numB : numB - numA;
          }
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
        if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return {
      total: result.length,
      items: result
    };
  }, [filteredData, searchQuery, sortColumn, sortDirection, isOpen]);

  // Paginated chunk
  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return processedData.items.slice(startIndex, endIndex);
  }, [processedData.items, page]);

  const totalPages = Math.ceil(processedData.total / pageSize);

  const handleExport = () => {
    if (processedData.items.length === 0) return;
    const csvContent = Papa.unparse(processedData.items);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `h1b_filtered_export_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render pagination buttons
  const renderPaginationButtons = () => {
    const buttons = [];
    const range = 1;

    // Previous
    buttons.push(
      <button 
        key="prev"
        className="pg-btn"
        disabled={page === 1}
        onClick={() => setPage(p => Math.max(1, p - 1))}
      >
        <ChevronLeft size={14} />
      </button>
    );

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - range && i <= page + range)) {
        buttons.push(
          <button 
            key={i}
            className={`pg-btn ${page === i ? 'active' : ''}`}
            onClick={() => setPage(i)}
          >
            {i}
          </button>
        );
      } else if (i === 2 || i === totalPages - 1) {
        buttons.push(
          <span 
            key={`ellipsis-${i}`}
            className="pg-btn" 
            style={{ border: 'none', cursor: 'default' }}
          >
            ...
          </span>
        );
      }
    }

    // Next
    buttons.push(
      <button 
        key="next"
        className="pg-btn"
        disabled={page === totalPages}
        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
      >
        <ChevronRight size={14} />
      </button>
    );

    return buttons;
  };

  const startIndex = processedData.total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(startIndex + pageSize - 1, processedData.total);

  return (
    <section className="card table-card-collapsible">
      <details 
        id="table-details-expander"
        open={isOpen}
        onToggle={(e) => setIsOpen(e.target.open)}
      >
        <summary className="table-summary-header">
          <div className="card-header-title">
            <Database />
            <h3>Raw Data Explorer</h3>
          </div>
          <span className="summary-toggle-icon">
            <ChevronDown />
          </span>
        </summary>
        
        {isOpen && (
          <div className="details-body">
            <div className="table-actions-bar">
              <div className="search-wrapper">
                <Search className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search rows..." 
                  className="search-input"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={handleExport}
                disabled={processedData.items.length === 0}
              >
                <Download size={14} /> Export Filtered CSV
              </button>
            </div>
            
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    {tableHeaders.map(h => {
                      let indicator = '↕';
                      if (sortColumn === h.key) {
                        indicator = sortDirection === 'asc' ? '↑' : '↓';
                      }
                      return (
                        <th key={h.key} onClick={() => handleSort(h.key)}>
                          {h.label} <span className="sort-indicator">{indicator}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={tableHeaders.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((row, idx) => (
                      <tr key={idx}>
                        {tableHeaders.map(h => {
                          const val = row[h.key];
                          if (h.key === 'PREVAILING_WAGE') {
                            return (
                              <td key={h.key} style={{ textAlign: 'right' }}>
                                {typeof val === 'number' ? `$${val.toLocaleString()}` : String(val)}
                              </td>
                            );
                          }
                          return (
                            <td key={h.key}>
                              {val === null || val === undefined ? '' : String(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="privacy-note-table">
                <ShieldCheck />
                <span>All data processing runs locally in your browser.</span>
              </div>
            </div>
            
            {totalPages > 1 && (
              <div className="table-footer">
                <span className="table-info">
                  Showing {startIndex} to {endIndex} of {processedData.total.toLocaleString()} records
                </span>
                <div className="pagination-controls">
                  {renderPaginationButtons()}
                </div>
              </div>
            )}
          </div>
        )}
      </details>
    </section>
  );
};

export default DataTable;
