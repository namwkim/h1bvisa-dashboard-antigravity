import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { Activity } from 'lucide-react';

const TimelineChart = ({ 
  allData, 
  stateFilter, 
  yearMin, 
  yearMax, 
  mainMeasure, 
  onMainMeasureChange,
  onYearRangeChange 
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

  // Helper to format state name nicely
  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => {
      if (word === 'of') return 'of';
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !allData || allData.length === 0) return;

    // Aggregating H-1B metrics by YEAR
    const yearsAgg = {
      2011: { count: 0, sumWage: 0, wageCount: 0 },
      2012: { count: 0, sumWage: 0, wageCount: 0 },
      2013: { count: 0, sumWage: 0, wageCount: 0 },
      2014: { count: 0, sumWage: 0, wageCount: 0 },
      2015: { count: 0, sumWage: 0, wageCount: 0 },
      2016: { count: 0, sumWage: 0, wageCount: 0 }
    };

    const targetDataset = stateFilter 
      ? allData.filter(row => row.STATE && row.STATE.toUpperCase() === stateFilter)
      : allData;

    targetDataset.forEach(row => {
      const yr = row.YEAR;
      if (yearsAgg[yr]) {
        yearsAgg[yr].count++;
        const wage = Number(row.PREVAILING_WAGE);
        if (wage > 0 && !isNaN(wage)) {
          yearsAgg[yr].sumWage += wage;
          yearsAgg[yr].wageCount++;
        }
      }
    });

    const labels = [2011, 2012, 2013, 2014, 2015, 2016];
    const chartData = labels.map(yr => {
      let val = 0;
      if (mainMeasure === 'petitions') {
        val = yearsAgg[yr].count;
      } else {
        val = yearsAgg[yr].wageCount > 0 ? Math.round(yearsAgg[yr].sumWage / yearsAgg[yr].wageCount) : 0;
      }
      return { year: yr, value: val };
    });

    const activeChartData = chartData.filter(d => d.year >= yearMin && d.year <= yearMax);

    container.innerHTML = '';
    
    const width = container.clientWidth || 600;
    const height = 240;
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('overflow', 'visible');

    // Tooltip selection
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

    // Gradient definition for area fill
    const defs = svg.append('defs');
    const areaGrad = defs.append('linearGradient')
      .attr('id', 'timeline-area-grad')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    areaGrad.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', 'var(--chart-primary)') // Brand primary
      .attr('stop-opacity', 0.45);
    areaGrad.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', 'var(--chart-primary)') // Brand primary
      .attr('stop-opacity', 0.0);

    const xScale = d3.scaleLinear()
      .domain([2011, 2016])
      .range([margin.left, width - margin.right]);

    const maxValue = d3.max(chartData, d => d.value) || 10;
    const yScale = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .range([height - margin.bottom, margin.top]);

    // Grid lines
    svg.append('g')
      .attr('class', 'grid-lines')
      .attr('opacity', 0.05)
      .call(d3.axisLeft(yScale)
        .tickSize(-width + margin.left + margin.right)
        .tickFormat('')
      )
      .attr('transform', `translate(${margin.left}, 0)`)
      .select('.domain').remove();

    // Axes
    const xAxis = d3.axisBottom(xScale)
      .tickValues(labels)
      .tickFormat(d3.format('d'));
    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => {
        if (mainMeasure === 'petitions') {
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

    const yLabel = mainMeasure === 'petitions' ? 'Certified Petitions' : 'Average Wage ($)';
    svg.append('text')
      .attr('aria-label', 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -margin.top)
      .attr('y', margin.left - 45)
      .attr('text-anchor', 'end')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '10px')
      .text(yLabel);

    // Draw background faded area and line (full span 2011-2016)
    const areaGenerator = d3.area()
      .x(d => xScale(d.year))
      .y0(height - margin.bottom)
      .y1(d => yScale(d.value))
      .curve(d3.curveLinear);

    const lineGenerator = d3.line()
      .x(d => xScale(d.year))
      .y(d => yScale(d.value))
      .curve(d3.curveLinear);

    svg.append('path')
      .datum(chartData)
      .attr('class', 'bg-area')
      .attr('fill', 'var(--text-muted)')
      .attr('fill-opacity', 0.04)
      .attr('d', areaGenerator);

    svg.append('path')
      .datum(chartData)
      .attr('class', 'bg-line')
      .attr('fill', 'none')
      .attr('stroke', 'var(--text-muted)')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.15)
      .attr('d', lineGenerator);

    if (activeChartData.length > 0) {
      // Glowing highlighted area
      svg.append('path')
        .datum(activeChartData)
        .attr('class', 'active-area')
        .attr('fill', 'url(#timeline-area-grad)')
        .attr('d', areaGenerator);

      // Highlighted active line
      const activeLine = svg.append('path')
        .datum(activeChartData)
        .attr('class', 'active-line')
        .attr('fill', 'none')
        .attr('stroke', 'var(--chart-primary)') // Brand primary
        .attr('stroke-width', 2.5)
        .attr('d', lineGenerator);

      // Transition: Animate line entrance from left-to-right
      const totalLength = activeLine.node().getTotalLength();
      activeLine
        .attr('stroke-dasharray', totalLength + ' ' + totalLength)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(600)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0);

      // Interactive Dots for active years
      const dots = svg.selectAll('.timeline-dot')
        .data(activeChartData)
        .enter()
        .append('circle')
        .attr('class', 'timeline-dot')
        .attr('cx', d => xScale(d.year))
        .attr('cy', d => yScale(d.value))
        .attr('r', 0)
        .attr('fill', 'var(--bg-secondary)')
        .attr('stroke', 'var(--chart-primary)') // Brand primary
        .attr('stroke-width', 2.5);

      dots.transition()
        .delay((d, i) => i * 80)
        .duration(300)
        .attr('r', 4.5);
    }

    // Interactive hover guides
    const focus = svg.append('g')
      .attr('class', 'focus')
      .style('display', 'none');

    focus.append('line')
      .attr('class', 'focus-line')
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('stroke', 'var(--chart-primary)') // Brand primary
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    focus.append('circle')
      .attr('class', 'focus-circle')
      .attr('r', 6.5)
      .attr('fill', 'var(--chart-primary)') // Brand primary
      .attr('stroke', 'var(--bg-secondary)')
      .attr('stroke-width', 1.5);

    // D3 Brush configuration
    const brush = d3.brushX()
      .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]])
      .on('brush end', function(event) {
        if (!event.sourceEvent) return; // Skip programmatic movements

        const selection = event.selection;
        let newMin = 2011;
        let newMax = 2016;

        if (selection) {
          const [x0, x1] = selection;
          let y0 = Math.round(xScale.invert(x0));
          let y1 = Math.round(xScale.invert(x1));
          
          newMin = Math.max(2011, Math.min(2016, y0));
          newMax = Math.max(2011, Math.min(2016, y1));

          // Update text display immediately during active drag
          d3.select('#year-range-display').text(`${newMin} - ${newMax}`);

          if (event.type === 'end') {
            // Snap transition to exact ticks
            const snap0 = xScale(y0);
            const snap1 = xScale(y1);
            d3.select(this)
              .transition()
              .duration(150)
              .call(brush.move, y0 === y1 ? null : [snap0, snap1]);

            if (newMin !== yearMin || newMax !== yearMax) {
              onYearRangeChange(newMin, newMax);
            }
          }
        } else {
          // If brush selection is cleared
          d3.select('#year-range-display').text('2011 - 2016');
          if (event.type === 'end') {
            if (yearMin !== 2011 || yearMax !== 2016) {
              onYearRangeChange(2011, 2016);
            }
          }
        }
      });

    const brushG = svg.append('g')
      .attr('class', 'brush')
      .call(brush);

    // Initialize brush selection matching state
    if (yearMin !== 2011 || yearMax !== 2016) {
      const pxMin = xScale(yearMin);
      const pxMax = xScale(yearMax);
      brushG.call(brush.move, [pxMin, pxMax]);
    } else {
      brushG.call(brush.move, null);
    }

    // Attach tracking mouse movements inside the brush container
    brushG.on('mouseover', () => focus.style('display', null))
      .on('mouseout', () => {
        focus.style('display', 'none');
        if (chartTooltip) chartTooltip.style.opacity = '0';
      })
      .on('mousemove', function(event) {
        const mouseX = d3.pointer(event, this)[0];
        
        // Bisect coordinates to find nearest year
        const x0 = xScale.invert(mouseX);
        const i = d3.bisector(d => d.year).left(chartData, x0, 1);
        const d0 = chartData[i - 1];
        const d1 = chartData[i];
        let d = d0;
        if (d1 && d0) {
          d = x0 - d0.year > d1.year - x0 ? d1 : d0;
        }
        
        if (d) {
          const cx = xScale(d.year);
          const cy = yScale(d.value);
          focus.select('.focus-line')
            .attr('x1', cx)
            .attr('x2', cx);
          focus.select('.focus-circle')
            .attr('cx', cx)
            .attr('cy', cy);

          let valueStr = mainMeasure === 'petitions' 
            ? `${d.value.toLocaleString()} Petitions`
            : `$${d.value.toLocaleString()} Avg Salary`;

          if (chartTooltip) {
            chartTooltip.style.opacity = '1';
            chartTooltip.innerHTML = `<strong>Year: ${d.year}</strong><br>${valueStr}`;
            chartTooltip.style.left = `${event.pageX + 15}px`;
            chartTooltip.style.top = `${event.pageY - 15}px`;
          }
        }
      });

    return () => {
      if (chartTooltip) chartTooltip.style.opacity = '0';
    };
  }, [allData, stateFilter, yearMin, yearMax, mainMeasure, onYearRangeChange, resizeCount]);

  // Dynamic Chart Header Title
  const getTimelineTitle = () => {
    const timelineText = mainMeasure === 'petitions' 
      ? "H-1B Visa Petitions Over Time" 
      : "Average Salary Over Time";
    return stateFilter 
      ? `${timelineText} in ${toTitleCase(stateFilter)}` 
      : timelineText;
  };

  return (
    <section className="card timeline-section">
      <div className="card-header timeline-header">
        <div className="card-header-title">
          <Activity />
          <h3 id="timeline-title">{getTimelineTitle()}</h3>
        </div>
        <div className="control-group">
          <label htmlFor="timeline-measure-select">Measure</label>
          <select 
            id="timeline-measure-select" 
            className="custom-select-sm"
            value={mainMeasure}
            onChange={(e) => onMainMeasureChange(e.target.value)}
          >
            <option value="petitions">Petition Volume</option>
            <option value="salary">Average Salary</option>
          </select>
        </div>
      </div>
      <div className="timeline-chart-wrapper">
        <div ref={containerRef} id="timeline-chart-container" className="chart-container-large"></div>
      </div>
      <div className="slider-timeline-container">
        <div className="slider-details">
          <span>Selected Timeline Range:</span>
          <span className="range-display" id="year-range-display">{yearMin} - {yearMax}</span>
        </div>
      </div>
    </section>
  );
};

export default TimelineChart;
