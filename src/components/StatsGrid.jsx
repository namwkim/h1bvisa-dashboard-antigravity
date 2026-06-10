import React, { useMemo } from 'react';
import { FileText, DollarSign, Building2, Briefcase } from 'lucide-react';

const StatsGrid = ({ filteredData }) => {
  const metrics = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return {
        petitions: '0',
        avgWage: '$0',
        topEmployer: '-',
        topJob: '-'
      };
    }

    const total = filteredData.length;

    let wageSum = 0;
    let wageCount = 0;
    const employerCounts = {};
    const jobCounts = {};

    filteredData.forEach(row => {
      // Prevailing Wage
      const wage = Number(row.PREVAILING_WAGE);
      if (wage > 0 && !isNaN(wage)) {
        wageSum += wage;
        wageCount++;
      }

      // Employer
      if (row.EMPLOYER_NAME) {
        employerCounts[row.EMPLOYER_NAME] = (employerCounts[row.EMPLOYER_NAME] || 0) + 1;
      }

      // Job Title
      if (row.JOB_TITLE) {
        jobCounts[row.JOB_TITLE] = (jobCounts[row.JOB_TITLE] || 0) + 1;
      }
    });

    const averageWage = wageCount > 0 ? Math.round(wageSum / wageCount) : 0;
    const avgWageStr = `$${averageWage.toLocaleString()}`;

    // Find Top Employer
    let topEmp = '-';
    let topEmpCount = 0;
    Object.keys(employerCounts).forEach(emp => {
      if (employerCounts[emp] > topEmpCount) {
        topEmpCount = employerCounts[emp];
        topEmp = emp;
      }
    });

    // Find Top Job
    let topJob = '-';
    let topJobCount = 0;
    Object.keys(jobCounts).forEach(job => {
      if (jobCounts[job] > topJobCount) {
        topJobCount = jobCounts[job];
        topJob = job;
      }
    });

    // Format strings
    const toTitleCase = (str) => {
      if (!str || str === '-') return '-';
      return str.toLowerCase().split(' ').map(word => {
        if (word === 'of' || word === 'and') return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      }).join(' ');
    };

    return {
      petitions: total.toLocaleString(),
      avgWage: avgWageStr,
      topEmployer: toTitleCase(topEmp),
      topJob: toTitleCase(topJob)
    };
  }, [filteredData]);

  return (
    <section className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon">
          <FileText />
        </div>
        <div className="stat-info">
          <span className="stat-label">Total Petitions</span>
          <h3 className="stat-value">{metrics.petitions}</h3>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">
          <DollarSign />
        </div>
        <div className="stat-info">
          <span className="stat-label">Average Salary</span>
          <h3 className="stat-value">{metrics.avgWage}</h3>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">
          <Building2 />
        </div>
        <div className="stat-info">
          <span className="stat-label">Top Employer</span>
          <h3 className="stat-value text-truncate" title={metrics.topEmployer}>
            {metrics.topEmployer}
          </h3>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon">
          <Briefcase />
        </div>
        <div className="stat-info">
          <span className="stat-label">Top Job Title</span>
          <h3 className="stat-value text-truncate" title={metrics.topJob}>
            {metrics.topJob}
          </h3>
        </div>
      </div>
    </section>
  );
};

export default StatsGrid;
