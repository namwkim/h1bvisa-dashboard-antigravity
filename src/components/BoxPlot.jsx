import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

// Percentile helper
const getPercentile = (arr, p) => {
  if (arr.length === 0) return 0;
  const index = (arr.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return arr[lower] * (1 - weight) + arr[upper] * weight;
};

const BoxPlot = ({ 
  filteredData, 
  barDimension 
}) => {
  const containerRef = useRef(null);
  const [resizeCount, setResizeCount] = useState(0);

  useEffect(() => {
    let timer;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setResizeCount(prev => prev + 1);
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => {
      if (word === 'of' || word === 'and') return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!filteredData || filteredData.length === 0) {
      container.innerHTML = '<div class="map-loading">No H-1B records to generate box plot.</div>';
      return;
    }

    // 1. Find the top 5 groups of the active dimension by petition counts
    const counts = {};
    filteredData.forEach(row => {
      const key = row[barDimension];
      if (key) {
        const cleanKey = String(key).toUpperCase().trim();
        counts[cleanKey] = (counts[cleanKey] || 0) + 1;
      }
    });

    const top5Names = Object.keys(counts)
      .sort((a, b) => counts[b] - counts[a])
      .slice(0, 5);

    if (top5Names.length === 0) {
      container.innerHTML = '<div class="map-loading">No category items found.</div>';
      return;
    }

    // 2. Extract wages for each of these top 5 categories
    const categoryWages = {};
    top5Names.forEach(name => {
      categoryWages[name] = [];
    });

    let allTop5Wages = [];
    filteredData.forEach(row => {
      const key = row[barDimension];
      if (key) {
        const name = String(key).toUpperCase().trim();
        if (top5Names.includes(name)) {
          const w = Number(row.PREVAILING_WAGE);
          if (w > 0 && !isNaN(w)) {
            categoryWages[name].push(w);
            allTop5Wages.push(w);
          }
        }
      }
    });

    if (allTop5Wages.length === 0) {
      container.innerHTML = '<div class="map-loading">No salary metrics available for box plot.</div>';
      return;
    }

    allTop5Wages.sort((a, b) => a - b);
    const globalMaxPercentile = getPercentile(allTop5Wages, 0.95);
    const xMaxLimit = globalMaxPercentile * 1.1;

    // Calculate boxplot stats for each category
    const boxStats = top5Names.map(name => {
      const wages = categoryWages[name].sort((a, b) => a - b);
      if (wages.length === 0) return null;

      const q1 = getPercentile(wages, 0.25);
      const median = getPercentile(wages, 0.50);
      const q3 = getPercentile(wages, 0.75);
      const minVal = wages[0];
      const maxVal = wages[wages.length - 1];

      const iqr = q3 - q1;
      const whiskerMin = Math.max(minVal, q1 - 1.5 * iqr);
      const whiskerMax = Math.min(maxVal, q3 + 1.5 * iqr);

      // Outliers (clipped to view limit)
      const outliers = wages.filter(w => (w < whiskerMin || w > whiskerMax) && w <= xMaxLimit);
      // Sample outliers to prevent SVG bloat
      const sampledOutliers = [];
      const sampleRate = Math.max(1, Math.floor(outliers.length / 50));
      for (let i = 0; i < outliers.length; i += sampleRate) {
        sampledOutliers.push(outliers[i]);
      }

      return {
        name: name,
        q1: q1,
        median: median,
        q3: q3,
        whiskerMin: whiskerMin,
        whiskerMax: whiskerMax,
        outliers: sampledOutliers,
        count: wages.length
      };
    }).filter(d => d !== null);

    container.innerHTML = '';

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 340;
    const margin = { top: 20, right: 30, bottom: 45, left: 130 };

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('overflow', 'visible');

    // Tooltip
    let chartTooltip = document.getElementById('chart-tooltip');
    if (!chartTooltip) {
      chartTooltip = document.createElement('div');
      chartTooltip.id = 'chart-tooltip';
      chartTooltip.className = 'map-tooltip';
      chartTooltip.style.opacity = '0';
      chartTooltip.style.position = 'absolute';
      chartTooltip.style.pointerEvents = 'none';
      chartTooltip.style.zIndex = '1000';
      chartTooltip.style.transition = 'opacity 0.15s ease';
      document.body.appendChild(chartTooltip);
    }

    const xScale = d3.scaleLinear()
      .domain([0, xMaxLimit])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleBand()
      .domain(top5Names)
      .range([margin.top, height - margin.bottom])
      .padding(0.4);

    // Grid lines
    svg.append('g')
      .attr('class', 'grid-lines')
      .attr('opacity', 0.05)
      .call(d3.axisBottom(xScale)
        .tickSize(height - margin.top - margin.bottom)
        .tickFormat('')
      )
      .attr('transform', `translate(0, ${margin.top})`)
      .select('.domain').remove();

    // Axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(5)
      .tickFormat(d => '$' + (d >= 1000 ? (d / 1000) + 'k' : d));

    const yAxis = d3.axisLeft(yScale)
      .tickFormat(d => {
        const label = toTitleCase(d);
        return label.length > 20 ? label.substring(0, 17) + '...' : label;
      });

    svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(xAxis)
      .attr('font-size', '10px')
      .attr('color', 'var(--text-secondary)');

    svg.append('g')
      .attr('class', 'y-axis')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(yAxis)
      .attr('font-size', '10px')
      .attr('color', 'var(--text-secondary)')
      .selectAll('.tick text')
      .append('title')
      .text(d => toTitleCase(d));

    // Style standard axis lines
    svg.selectAll('.domain').style('stroke', 'var(--border-color)').style('stroke-width', '1px');
    svg.selectAll('.tick line').style('stroke', 'var(--border-color)').style('stroke-width', '1px');

    // Centered label for boxplot X-axis
    svg.append('text')
      .attr('aria-label', 'x-axis-label')
      .attr('x', (width - margin.left - margin.right) / 2 + margin.left)
      .attr('y', height - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '10px')
      .text('Prevailing Wage ($)');

    // Render a group for each boxplot row
    const rowG = svg.selectAll('.boxplot-row')
      .data(boxStats)
      .enter()
      .append('g')
      .attr('class', 'boxplot-row')
      .attr('transform', d => `translate(0, ${yScale(d.name) + yScale.bandwidth() / 2})`);

    // Whisker line
    rowG.append('line')
      .attr('x1', d => xScale(d.whiskerMin))
      .attr('x2', d => xScale(d.whiskerMin))
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', 'var(--text-muted)')
      .attr('stroke-width', 1.5)
      .transition()
      .duration(500)
      .attr('x2', d => xScale(d.whiskerMax));

    // Whisker tick left
    rowG.append('line')
      .attr('x1', d => xScale(d.whiskerMin))
      .attr('x2', d => xScale(d.whiskerMin))
      .attr('y1', -6)
      .attr('y2', 6)
      .attr('stroke', 'var(--text-muted)')
      .attr('stroke-width', 1.5);

    // Whisker tick right
    rowG.append('line')
      .attr('x1', d => xScale(d.whiskerMax))
      .attr('x2', d => xScale(d.whiskerMax))
      .attr('y1', -6)
      .attr('y2', 6)
      .attr('stroke', 'var(--text-muted)')
      .attr('stroke-width', 1.5);

    // Box Rect
    rowG.append('rect')
      .attr('x', d => xScale(d.q1))
      .attr('width', 0)
      .attr('y', -yScale.bandwidth() / 2)
      .attr('height', yScale.bandwidth())
      .attr('fill', 'var(--chart-primary)')
      .attr('fill-opacity', 0.65)
      .attr('stroke', 'var(--chart-primary)')
      .attr('stroke-width', 1.5)
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('fill-opacity', 0.85);
        if (chartTooltip) {
          chartTooltip.style.opacity = '1';
          chartTooltip.innerHTML = `
            <strong>${toTitleCase(d.name)}</strong><br>
            Median: $${Math.round(d.median).toLocaleString()}<br>
            Q1 (25%): $${Math.round(d.q1).toLocaleString()}<br>
            Q3 (75%): $${Math.round(d.q3).toLocaleString()}<br>
            Whisker Span: $${Math.round(d.whiskerMin).toLocaleString()} - $${Math.round(d.whiskerMax).toLocaleString()}
          `;
          chartTooltip.style.left = `${event.pageX + 15}px`;
          chartTooltip.style.top = `${event.pageY - 15}px`;
        }
      })
      .on('mousemove', function(event) {
        if (chartTooltip) {
          chartTooltip.style.left = `${event.pageX + 15}px`;
          chartTooltip.style.top = `${event.pageY - 15}px`;
        }
      })
      .on('mouseout', function() {
        d3.select(this).attr('fill-opacity', 0.65);
        if (chartTooltip) chartTooltip.style.opacity = '0';
      })
      .transition()
      .duration(650)
      .attr('width', d => xScale(d.q3) - xScale(d.q1));

    // Median Line
    rowG.append('line')
      .attr('x1', d => xScale(d.median))
      .attr('x2', d => xScale(d.median))
      .attr('y1', -yScale.bandwidth() / 2)
      .attr('y2', yScale.bandwidth() / 2)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    // Outliers (drawn as dots)
    rowG.each(function(d, i) {
      const rowSelection = d3.select(this);
      const dots = rowSelection.selectAll('.boxplot-outlier')
        .data(d.outliers)
        .enter()
        .append('circle')
        .attr('class', 'boxplot-outlier')
        .attr('cx', w => xScale(w))
        .attr('cy', 0)
        .attr('r', 0)
        .attr('fill', 'none')
        .attr('stroke', 'var(--chart-primary)')
        .attr('stroke-width', 1.0)
        .attr('stroke-opacity', 0.5)
        .on('mouseover', function(event, w) {
          d3.select(this).attr('r', 4).attr('stroke-opacity', 1.0).attr('fill', 'var(--chart-primary)');
          if (chartTooltip) {
            chartTooltip.style.opacity = '1';
            chartTooltip.innerHTML = `<strong>Salary Outlier</strong><br>$${Math.round(w).toLocaleString()}`;
            chartTooltip.style.left = `${event.pageX + 15}px`;
            chartTooltip.style.top = `${event.pageY - 15}px`;
          }
        })
        .on('mousemove', function(event) {
          if (chartTooltip) {
            chartTooltip.style.left = `${event.pageX + 15}px`;
            chartTooltip.style.top = `${event.pageY - 15}px`;
          }
        })
        .on('mouseout', function() {
          d3.select(this).attr('r', 2).attr('stroke-opacity', 0.5).attr('fill', 'none');
          if (chartTooltip) chartTooltip.style.opacity = '0';
        });

      dots.transition()
        .duration(400)
        .delay((w, idx) => idx * 3)
        .attr('r', 2);
    });

    return () => {
      if (chartTooltip) chartTooltip.style.opacity = '0';
    };
  }, [filteredData, barDimension, resizeCount]);

  return (
    <div id="boxplot-widget" className="boxplot-widget-container">
      <div ref={containerRef} id="boxplot-chart-container" className="boxplot-svg-wrapper"></div>
    </div>
  );
};

export default BoxPlot;
export { getPercentile };
