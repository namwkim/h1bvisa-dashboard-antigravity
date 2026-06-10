import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { ScatterChart as LucideScatter } from 'lucide-react';

const ScatterChart = ({ 
  filteredData, 
  barDimension, 
  mainMeasure, 
  scatterYMeasure, 
  onScatterYMeasureChange 
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
      container.innerHTML = '<div class="map-loading">No correlation data available.</div>';
      return;
    }

    // Grouping filteredData by selected dimension
    const grouping = {};
    filteredData.forEach(row => {
      const key = row[barDimension];
      if (!key) return;

      const cleanKey = String(key).toUpperCase().trim();
      const wage = Number(row.PREVAILING_WAGE);

      if (!grouping[cleanKey]) {
        grouping[cleanKey] = { name: cleanKey, count: 0, wageSum: 0, wageCount: 0 };
      }
      
      grouping[cleanKey].count++;
      if (wage > 0 && !isNaN(wage)) {
        grouping[cleanKey].wageSum += wage;
        grouping[cleanKey].wageCount++;
      }
    });

    // Convert to array and take top 50 items by petition volume to avoid chart crowding
    const items = Object.values(grouping);
    items.sort((a, b) => b.count - a.count);
    const top50 = items.slice(0, 50);

    // Prepare point coordinates
    const points = top50.map(item => {
      const avgWage = item.wageCount > 0 ? Math.round(item.wageSum / item.wageCount) : 0;
      let xVal = mainMeasure === 'petitions' ? item.count : avgWage;
      let yVal = scatterYMeasure === 'salary' ? avgWage : item.count;
      return { x: xVal, y: yVal, label: item.name };
    });

    container.innerHTML = '';

    if (points.length === 0) {
      container.innerHTML = '<div class="map-loading">No correlation data available.</div>';
      return;
    }

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 340;
    const margin = { top: 15, right: 25, bottom: 40, left: 60 };

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
      .domain([0, d3.max(points, d => d.x) * 1.05 || 10])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(points, d => d.y) * 1.05 || 10])
      .range([height - margin.bottom, margin.top]);

    // X Grid
    svg.append('g')
      .attr('class', 'grid-lines')
      .attr('opacity', 0.05)
      .call(d3.axisBottom(xScale)
        .tickSize(height - margin.top - margin.bottom)
        .tickFormat('')
      )
      .attr('transform', `translate(0, ${margin.top})`)
      .select('.domain').remove();

    // Y Grid
    svg.append('g')
      .attr('class', 'grid-lines')
      .attr('opacity', 0.05)
      .call(d3.axisLeft(yScale)
        .tickSize(-width + margin.left + margin.right)
        .tickFormat('')
      )
      .attr('transform', `translate(${margin.left}, 0)`)
      .select('.domain').remove();

    // Labels
    const xLabel = mainMeasure === 'petitions' ? 'Petition Volume' : 'Average Wage ($)';
    const yLabel = scatterYMeasure === 'salary' ? 'Average Wage ($)' : 'Petition Volume';

    // Axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(5)
      .tickFormat(d => {
        if (mainMeasure === 'petitions') {
          return d >= 1000 ? (d / 1000) + 'k' : d;
        } else {
          return '$' + (d >= 1000 ? (d / 1000) + 'k' : d);
        }
      });

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => {
        if (scatterYMeasure === 'petitions') {
          return d >= 1000 ? (d / 1000) + 'k' : d;
        } else {
          return '$' + (d >= 1000 ? (d / 1000) + 'k' : d);
        }
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
      .attr('color', 'var(--text-secondary)');

    // Style standard axis lines
    svg.selectAll('.domain').style('stroke', 'var(--border-color)').style('stroke-width', '1px');
    svg.selectAll('.tick line').style('stroke', 'var(--border-color)').style('stroke-width', '1px');

    // Add labels to axes
    svg.append('text')
      .attr('aria-label', 'x-axis-label')
      .attr('x', width - margin.right)
      .attr('y', height - margin.bottom + 30)
      .attr('text-anchor', 'end')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '10px')
      .text(xLabel);

    svg.append('text')
      .attr('aria-label', 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -margin.top)
      .attr('y', margin.left - 45)
      .attr('text-anchor', 'end')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '10px')
      .text(yLabel);

    // Dots
    const dots = svg.selectAll('.scatter-dot')
      .data(points)
      .enter()
      .append('circle')
      .attr('class', 'scatter-dot')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', 0)
      .attr('fill', 'var(--chart-primary)') // Brand primary
      .attr('fill-opacity', 0.25)
      .attr('stroke', 'var(--chart-primary)') // Brand primary
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('fill-opacity', 0.85)
          .transition()
          .duration(150)
          .attr('r', 8.5);

        if (chartTooltip) {
          chartTooltip.style.opacity = '1';
          chartTooltip.innerHTML = `
            <strong>${toTitleCase(d.label)}</strong><br>
            ${xLabel}: ${d.x.toLocaleString()}<br>
            ${yLabel}: ${d.y.toLocaleString()}
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
        d3.select(this)
          .attr('fill-opacity', 0.25)
          .transition()
          .duration(150)
          .attr('r', 5.5);
        if (chartTooltip) chartTooltip.style.opacity = '0';
      });

    dots.transition()
      .duration(600)
      .delay((d, i) => i * 8)
      .ease(d3.easeElasticOut.amplitude(1.0).period(0.6))
      .attr('r', 5.5);

    return () => {
      if (chartTooltip) chartTooltip.style.opacity = '0';
    };
  }, [filteredData, barDimension, mainMeasure, scatterYMeasure, resizeCount]);

  // Dynamic Chart Header Title
  const getScatterTitle = () => {
    return barDimension === 'JOB_TITLE'
      ? "Salary & Petitions Correlation by Job Titles"
      : "Salary & Petitions Correlation by Companies";
  };

  return (
    <section className="card bottom-card">
      <div className="card-header">
        <div className="card-header-title">
          <LucideScatter />
          <h3 id="scatter-title">{getScatterTitle()}</h3>
        </div>
        <div className="control-group">
          <label htmlFor="scatter-y-select">Y-Axis Metric</label>
          <select 
            id="scatter-y-select" 
            className="custom-select-sm"
            value={scatterYMeasure}
            onChange={(e) => onScatterYMeasureChange(e.target.value)}
          >
            <option value="salary">Average Salary</option>
            <option value="petitions">Petition Volume</option>
          </select>
        </div>
      </div>
      <div ref={containerRef} id="scatter-chart-container" className="bottom-chart-container"></div>
    </section>
  );
};

export default ScatterChart;
