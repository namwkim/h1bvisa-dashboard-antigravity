import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as Papa from 'papaparse';
import LoadingOverlay from './components/LoadingOverlay';
import Header from './components/Header';
import StatsGrid from './components/StatsGrid';
import TimelineChart from './components/TimelineChart';
import BarChart from './components/BarChart';
import MapWidget from './components/MapWidget';
import BoxPlot from './components/BoxPlot';
import ScatterChart from './components/ScatterChart';
import DataTable from './components/DataTable';
import { Globe, BookOpen } from 'lucide-react';

import { STATE_MAPPING } from './utils/constants';

function App() {
  const [allData, setAllData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusText, setStatusText] = useState('Initializing application...');
  const [progress, setProgress] = useState(0);

  // States
  const [stateFilter, setStateFilter] = useState(null);
  const [yearMin, setYearMin] = useState(2011);
  const [yearMax, setYearMax] = useState(2016);
  const [mainMeasure, setMainMeasure] = useState('petitions'); // 'petitions' or 'salary'
  const [barDimension, setBarDimension] = useState('JOB_TITLE'); // 'JOB_TITLE' or 'EMPLOYER_NAME'
  const [centerToggle, setCenterToggle] = useState('map'); // 'map' or 'boxplot'
  const [scatterYMeasure, setScatterYMeasure] = useState('salary'); // 'salary' or 'petitions'
  // Default app context to light theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  // Adjust scatter metrics based on main measure selections
  const handleMainMeasureChange = useCallback((measure) => {
    setMainMeasure(measure);
    if (measure === 'petitions') {
      setScatterYMeasure('salary');
    } else {
      setScatterYMeasure('petitions');
    }
  }, []);

  // Helper to run CSV parsing via PapaParse
  const parseH1BCSV = (fileOrBlob) => {
    setIsLoading(true);
    setStatusText('Parsing CSV dataset in background (Web Worker)...');
    setProgress(70);

    Papa.parse(fileOrBlob, {
      header: true,
      dynamicTyping: true,
      worker: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          setStatusText('Cleaning and indexing dataset rows...');
          setProgress(85);

          // Clean up leading/trailing spaces on strings
          const cleaned = results.data.map(row => {
            const copy = { ...row };
            for (const key in copy) {
              if (typeof copy[key] === 'string') {
                copy[key] = copy[key].trim();
              }
            }
            return copy;
          });

          setStatusText('Rendering visualization elements...');
          setProgress(95);
          
          setAllData(cleaned);

          setTimeout(() => {
            setIsLoading(false);
            setProgress(100);
          }, 400);
        } else {
          setIsLoading(false);
          alert('No records found in CSV file.');
        }
      },
      error: (err) => {
        console.error('PapaParse error:', err);
        setIsLoading(false);
        alert('Failed to parse H-1B CSV file.');
      }
    });
  };

  // Preload local CSV file on mount
  useEffect(() => {
    const preloadDataset = async () => {
      try {
        setIsLoading(true);
        setStatusText('Fetching h1b_cleaned_filtered.csv...');
        setProgress(20);

        const response = await fetch('/h1b_cleaned_filtered.csv');
        if (!response.ok) {
          throw new Error('Local CSV file not found on dev server context');
        }

        setStatusText('Reading dataset payload into browser memory...');
        setProgress(45);
        const blob = await response.blob();

        parseH1BCSV(blob);
      } catch (err) {
        console.warn('Preload failed:', err);
        setIsLoading(false);
        alert('Could not preload h1b_cleaned_filtered.csv. Please upload it manually.');
      }
    };

    preloadDataset();
  }, []);

  // Filtering calculation pipeline
  const filteredData = useMemo(() => {
    if (allData.length === 0) return [];

    return allData.filter(row => {
      // Year Check
      if (row.YEAR < yearMin || row.YEAR > yearMax) return false;
      // State Check
      if (stateFilter && (!row.STATE || row.STATE.toUpperCase() !== stateFilter)) return false;
      return true;
    });
  }, [allData, stateFilter, yearMin, yearMax]);

  // Click handler to toggle active state filters on choropleth map clicks
  const handleStateFilterToggle = useCallback((stateName) => {
    setStateFilter(prev => prev === stateName ? null : stateName);
  }, []);

  const handleClearStateFilter = useCallback(() => {
    setStateFilter(null);
  }, []);

  const handleYearRangeChange = useCallback((min, max) => {
    setYearMin(min);
    setYearMax(max);
  }, []);

  // Dynamic titles for distribution widget
  const getCenterTitle = () => {
    if (centerToggle === 'map') {
      return mainMeasure === 'petitions'
        ? "State Distribution Map (Petition Volume)"
        : "State Distribution Map (Average Salary)";
    } else {
      return barDimension === 'JOB_TITLE'
        ? "Salary Distribution by Top Job Titles"
        : "Salary Distribution by Top Companies";
    }
  };

  return (
    <>
      <LoadingOverlay 
        isLoading={isLoading} 
        statusText={statusText} 
        progress={progress} 
      />

      <main className="main-content">
        <Header 
          stateFilter={stateFilter}
          onClearStateFilter={handleClearStateFilter}
        />

        <div className="content-scrollable">
          <StatsGrid filteredData={filteredData} />

          <TimelineChart 
            allData={allData} 
            stateFilter={stateFilter}
            yearMin={yearMin}
            yearMax={yearMax}
            mainMeasure={mainMeasure}
            onMainMeasureChange={handleMainMeasureChange}
            onYearRangeChange={handleYearRangeChange}
          />

          <div className="bottom-grid">
            <BarChart 
              filteredData={filteredData}
              barDimension={barDimension}
              mainMeasure={mainMeasure}
              onBarDimensionChange={setBarDimension}
            />

            {/* Center column container: Map or Box Plot */}
            <section className="card bottom-card">
              <div className="card-header">
                <div className="card-header-title">
                  <Globe />
                  <h3 id="center-title">{getCenterTitle()}</h3>
                </div>
                
                <div className="toggle-group-premium">
                  <input 
                    type="radio" 
                    id="toggle-map" 
                    name="center-toggle" 
                    value="map" 
                    checked={centerToggle === 'map'}
                    onChange={() => setCenterToggle('map')}
                  />
                  <label htmlFor="toggle-map" className="toggle-label">Map</label>
                  
                  <input 
                    type="radio" 
                    id="toggle-boxplot" 
                    name="center-toggle" 
                    value="boxplot" 
                    checked={centerToggle === 'boxplot'}
                    onChange={() => setCenterToggle('boxplot')}
                  />
                  <label htmlFor="toggle-boxplot" className="toggle-label">Box Plot</label>
                </div>
              </div>
              
              <div className="center-content-container">
                {centerToggle === 'map' ? (
                  <MapWidget 
                    allData={allData}
                    stateFilter={stateFilter}
                    yearMin={yearMin}
                    yearMax={yearMax}
                    mainMeasure={mainMeasure}
                    onStateFilterToggle={handleStateFilterToggle}
                  />
                ) : (
                  <BoxPlot 
                    filteredData={filteredData}
                    barDimension={barDimension}
                  />
                )}
              </div>
            </section>

            <ScatterChart 
              filteredData={filteredData}
              barDimension={barDimension}
              mainMeasure={mainMeasure}
              scatterYMeasure={scatterYMeasure}
              onScatterYMeasureChange={setScatterYMeasure}
            />
          </div>

          <DataTable filteredData={filteredData} />
        </div>
      </main>
    </>
  );
}

export default App;
