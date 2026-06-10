import React from 'react';
import { X } from 'lucide-react';

const Header = ({ stateFilter, onClearStateFilter }) => {
  // Helper to format state name nicely
  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => {
      if (word === 'of') return 'of';
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };

  return (
    <header className="header">
      <div className="header-left-group">
        <div className="logo-group">
          <h1>H-1B Visa Performance Dashboard</h1>
        </div>
      </div>
      
      {/* Active Filters Panel */}
      <div className={`header-filters ${stateFilter ? '' : 'hidden'}`}>
        {stateFilter && (
          <div className="filter-pill" id="state-filter-pill">
            <span>State: {toTitleCase(stateFilter)}</span>
            <button onClick={onClearStateFilter} aria-label="Clear Filter">
              <X size={13} />
            </button>
          </div>
        )}
      </div>


    </header>
  );
};

export default Header;
