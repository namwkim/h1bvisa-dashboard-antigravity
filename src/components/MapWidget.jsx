import React, { useRef, useEffect, useState } from 'react';
import { STATE_MAPPING } from '../utils/constants';

// Inverse mapping (SVG path ID -> US State full name)
const STATE_CODE_TO_NAME = {};
Object.keys(STATE_MAPPING).forEach(key => {
  STATE_CODE_TO_NAME[STATE_MAPPING[key]] = key;
});

const MapWidget = ({ 
  allData, 
  stateFilter, 
  yearMin, 
  yearMax, 
  mainMeasure, 
  onStateFilterToggle
}) => {
  const svgWrapperRef = useRef(null);
  const tooltipRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => {
      if (word === 'of') return 'of';
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };

  // 1. Fetch USA map SVG
  useEffect(() => {
    const fetchMap = async () => {
      try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/@svg-maps/usa@1.1.1/usa.svg');
        if (!response.ok) throw new Error('Failed to download Map SVG');
        
        let svgText = await response.text();
        if (svgWrapperRef.current) {
          svgWrapperRef.current.innerHTML = svgText;
          
          const svgElement = svgWrapperRef.current.querySelector('svg');
          if (svgElement) {
            svgElement.removeAttribute('width');
            svgElement.removeAttribute('height');
            setMapLoaded(true);
          }
        }
      } catch (err) {
        console.error('Error loading US Map SVG:', err);
        setErrorMsg('Error loading US Map. Ensure you are online.');
      }
    };

    fetchMap();
  }, []);

  // 2. Setup map events and color states
  useEffect(() => {
    if (!mapLoaded || !svgWrapperRef.current || !allData || allData.length === 0) return;

    const svgWrapper = svgWrapperRef.current;
    const paths = svgWrapper.querySelectorAll('path');
    const tooltip = tooltipRef.current;

    const baseRgb = getComputedStyle(document.documentElement).getPropertyValue('--chart-primary-rgb').trim() || '70, 113, 129';

    // Pre-calculate metrics for all states in a single O(N) pass
    const stateMetrics = {};
    const stateSums = {};
    Object.keys(STATE_MAPPING).forEach(stateName => {
      stateMetrics[stateName] = { count: 0, avgWage: 0 };
      stateSums[stateName] = 0;
    });

    const activeYearsData = allData.filter(row => row.YEAR >= yearMin && row.YEAR <= yearMax);
    activeYearsData.forEach(row => {
      if (row.STATE) {
        const stateName = row.STATE.toUpperCase();
        if (stateMetrics[stateName] !== undefined) {
          stateMetrics[stateName].count++;
          stateSums[stateName] += Number(row.PREVAILING_WAGE) || 0;
        }
      }
    });

    Object.keys(stateMetrics).forEach(stateName => {
      const m = stateMetrics[stateName];
      if (m.count > 0) {
        m.avgWage = stateSums[stateName] / m.count;
      }
    });

    const getStateMetrics = (stateName) => {
      return stateMetrics[stateName] || { count: 0, avgWage: 0 };
    };

    // Calculate metrics for all states to find min/max values
    const stateValues = {};
    let valuesArr = [];

    Object.keys(STATE_MAPPING).forEach(stateName => {
      const metrics = getStateMetrics(stateName);
      const val = mainMeasure === 'petitions' ? metrics.count : metrics.avgWage;
      stateValues[stateName] = val;
      if (val > 0) {
        valuesArr.push(val);
      }
    });

    const maxVal = valuesArr.length > 0 ? Math.max(...valuesArr) : 1;
    const minVal = valuesArr.length > 0 ? Math.min(...valuesArr) : 0;

    paths.forEach(path => {
      const code = path.getAttribute('id');
      const stateName = STATE_CODE_TO_NAME[code];

      // Reset styles
      path.removeAttribute('style');
      path.classList.remove('active-filter');

      if (!stateName) {
        path.style.fill = 'var(--accent-glow)';
        return;
      }

      // Check active state highlight
      if (stateFilter && stateFilter === stateName) {
        path.classList.add('active-filter');
        // Let CSS style handles active state
      } else {
        const val = stateValues[stateName] || 0;
        if (val === 0) {
          path.style.fill = 'var(--accent-glow)';
        } else {
          // Logarithmic scale
          let ratio = 0;
          if (maxVal > minVal && val > minVal) {
            ratio = Math.log(val - minVal + 1) / Math.log(maxVal - minVal + 1);
          } else if (val === maxVal) {
            ratio = 1;
          }
          const opacity = 0.05 + ratio * 0.85; // opacity ranges from 0.05 to 0.9
          path.style.fill = `rgba(${baseRgb}, ${opacity})`;
        }
      }

      // Clone listeners (removes old listeners to prevent leakages)
      const newPath = path.cloneNode(true);
      path.parentNode.replaceChild(newPath, path);

      // Bind interactions on the fresh path node
      newPath.addEventListener('mouseenter', (e) => {
        const metrics = getStateMetrics(stateName);
        if (tooltip) {
          tooltip.style.opacity = '1';
          let valueStr = '';
          if (mainMeasure === 'petitions') {
            valueStr = `${metrics.count.toLocaleString()} Petitions`;
          } else {
            valueStr = metrics.count > 0 
              ? `$${Math.round(metrics.avgWage).toLocaleString()} Avg Salary`
              : 'No Data';
          }
          tooltip.innerHTML = `<strong>${toTitleCase(stateName)}</strong><br>${valueStr}`;
        }
      });

      newPath.addEventListener('mousemove', (e) => {
        if (tooltip) {
          const mapRect = svgWrapper.getBoundingClientRect();
          const x = e.clientX - mapRect.left + 15;
          const y = e.clientY - mapRect.top + 10;
          tooltip.style.left = `${x}px`;
          tooltip.style.top = `${y}px`;
        }
      });

      newPath.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.style.opacity = '0';
      });

      newPath.addEventListener('click', () => {
        if (tooltip) tooltip.style.opacity = '0';
        onStateFilterToggle(stateName);
      });
    });

  }, [mapLoaded, allData, stateFilter, yearMin, yearMax, mainMeasure, onStateFilterToggle]);

  return (
    <div id="map-widget" className="map-widget-container">
      <div ref={tooltipRef} className="map-tooltip" id="map-tooltip" style={{ opacity: 0, position: 'absolute', pointerEvents: 'none', zIndex: 100 }}>
        Hover over a state
      </div>
      <div ref={svgWrapperRef} id="map-chart-container" className="map-svg-wrapper">
        {errorMsg ? (
          <div className="map-loading" style={{ color: 'var(--danger)' }}>{errorMsg}</div>
        ) : (
          <div className="map-loading">Loading US Map vectors...</div>
        )}
      </div>
    </div>
  );
};

export default MapWidget;
export { STATE_CODE_TO_NAME };
