import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { BarChart3 } from 'lucide-react';

const BarChart = ({ 
  filteredData, 
  barDimension, 
  mainMeasure, 
  onBarDimensionChange 
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
      container.innerHTML = '<div class="map-loading">No rankings available.</div>';
      return;
    }

    // Grouping filtered data by barDimension (EMPLOYER_NAME or JOB_TITLE)
    const grouping = {};
    filteredData.forEach(row => {
      const key = row[barDimension];
      if (!key) return;

      const cleanKey = String(key).toUpperCase().trim();
      const wage = Number(row.PREVAILING_WAGE);

      if (!grouping[cleanKey]) {
        grouping[cleanKey] = { count: 0, wageSum: 0, wageCount: 0 };
      }
      
      grouping[cleanKey].count++;
      if (wage > 0 && !isNaN(wage)) {
        grouping[cleanKey].wageSum += wage;
        grouping[cleanKey].wageCount++;
      }
    });

    // Convert to array
    const list = Object.keys(grouping).map(key => {
      const count = grouping[key].count;
      const avgWage = grouping[key].wageCount > 0 ? grouping[key].wageSum / grouping[key].wageCount : 0;
      return {
        name: key,
        value: mainMeasure === 'petitions' ? count : avgWage
      };
    });

    // Sort descending and take top 10
    list.sort((a, b) => b.value - a.value);
    const top10 = list.slice(0, 10);

    container.innerHTML = '';
    
    if (top10.length === 0) {
      container.innerHTML = '<div class="map-loading">No rankings available.</div>';
      return;
    }

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 340;
    const margin = { top: 10, right: 25, bottom: 40, left: 130 };

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
      .domain([0, d3.max(top10, d => d.value) * 1.05 || 10])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleBand()
      .domain(top10.map(d => d.name))
      .range([margin.top, height - margin.bottom])
      .padding(0.25);


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
      .tickFormat(d => {
        if (mainMeasure === 'petitions') {
          return d >= 1000 ? (d / 1000) + 'k' : d;
        } else {
          return '$' + (d >= 1000 ? (d / 1000) + 'k' : d);
        }
      });

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

    // Bars
    const bars = svg.selectAll('.bar')
      .data(top10)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('y', d => yScale(d.name))
      .attr('height', yScale.bandwidth())
      .attr('x', margin.left)
      .attr('width', 0)
      .attr('fill', 'var(--chart-primary)')
      .attr('rx', 4)
      .attr('ry', 4)
      .style('cursor', 'pointer')
      .style('transition', 'filter 0.15s ease')
      .on('mouseover', function(event, d) {
        d3.select(this).style('filter', 'brightness(1.2) saturate(1.1)');
        let valueStr = mainMeasure === 'petitions'
          ? `${d.value.toLocaleString()} Petitions`
          : `$${Math.round(d.value).toLocaleString()} Average Salary`;

        if (chartTooltip) {
          chartTooltip.style.opacity = '1';
          chartTooltip.innerHTML = `<strong>${toTitleCase(d.name)}</strong><br>${valueStr}`;
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
        d3.select(this).style('filter', null);
        if (chartTooltip) chartTooltip.style.opacity = '0';
      });

    bars.transition()
      .duration(600)
      .delay((d, i) => i * 40)
      .ease(d3.easeCubicOut)
      .attr('width', d => xScale(d.value) - margin.left);

    return () => {
      if (chartTooltip) chartTooltip.style.opacity = '0';
    };
  }, [filteredData, barDimension, mainMeasure, resizeCount]);

  // Dynamic Chart Card Title
  const getBarTitle = () => {
    if (mainMeasure === 'petitions') {
      return barDimension === 'JOB_TITLE'
        ? "Top Job Titles by Petition Volume"
        : "Top Companies by Petition Volume";
    } else {
      return barDimension === 'JOB_TITLE'
        ? "Average Salary by Job Titles"
        : "Average Salary by Companies";
    }
  };

  return (
    <section className="card bottom-card">
      <div className="card-header">
        <div className="card-header-title">
          <BarChart3 />
          <h3 id="bar-title">{getBarTitle()}</h3>
        </div>
        <div className="control-group">
          <label htmlFor="bar-dimension-select">Breakdown</label>
          <select 
            id="bar-dimension-select" 
            className="custom-select-sm"
            value={barDimension}
            onChange={(e) => onBarDimensionChange(e.target.value)}
          >
            <option value="JOB_TITLE">Job Titles</option>
            <option value="EMPLOYER_NAME">Companies</option>
          </select>
        </div>
      </div>
      <div ref={containerRef} id="bar-chart-container" className="bottom-chart-container"></div>
    </section>
  );
};

export default BarChart;
