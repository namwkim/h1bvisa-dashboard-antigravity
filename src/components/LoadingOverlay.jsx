import React from 'react';

const LoadingOverlay = ({ isLoading, statusText, progress }) => {
  return (
    <div id="loading-overlay" className={`loading-overlay ${isLoading ? '' : 'hidden'}`}>
      <div className="loader-content">
        <div className="spinner"></div>
        <h2>Processing H-1B Dataset</h2>
        <p id="loading-status">{statusText || 'Initializing...'}</p>
        <div className="progress-bar-container">
          <div 
            id="loading-progress" 
            className="progress-bar" 
            style={{ width: `${progress || 0}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
