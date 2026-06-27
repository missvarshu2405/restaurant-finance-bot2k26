// ============================================
// Charts Component — Chart.js Wrappers
// ============================================

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

// Customize Chart.js defaults for dark theme
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
Chart.defaults.plugins.legend.labels.padding = 16;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(17, 24, 39, 0.95)';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.titleFont = { weight: '600' };

const chartInstances = {};

export function destroyAllCharts() {
  Object.keys(chartInstances).forEach(id => {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  });
}

function destroyChart(canvasId) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
    delete chartInstances[canvasId];
  }
}

export function createLineChart(canvasId, { labels, datasets, yPrefix = '₹' }) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');

  const styledDatasets = datasets.map((ds, i) => {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    const color = ds.borderColor || colors[i % colors.length];
    return {
      ...ds,
      borderColor: color,
      backgroundColor: color + '15',
      borderWidth: 2.5,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: color,
      pointBorderColor: '#0a0e1a',
      pointBorderWidth: 2,
      tension: 0.4,
      fill: ds.fill !== undefined ? ds.fill : true,
    };
  });

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: styledDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 10 },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            callback: (val) => yPrefix + Number(val).toLocaleString('en-IN'),
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${yPrefix}${Number(ctx.parsed.y).toLocaleString('en-IN')}`,
          },
        },
      },
    },
  });

  return chartInstances[canvasId];
}

export function createDonutChart(canvasId, { labels, data, colors }) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  const defaultColors = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#3b82f6',
    '#a855f7', '#84cc16', '#e879f9', '#22d3ee', '#fb923c',
  ];

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors || defaultColors.slice(0, data.length),
        borderColor: '#0a0e1a',
        borderWidth: 3,
        hoverBorderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            padding: 12,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return `${ctx.label}: ₹${Number(ctx.parsed).toLocaleString('en-IN')} (${pct}%)`;
            },
          },
        },
      },
    },
  });

  return chartInstances[canvasId];
}

export function createBarChart(canvasId, { labels, datasets, horizontal = false, yPrefix = '₹', stacked = false }) {
  destroyChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  const ctx = canvas.getContext('2d');
  const defaultColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const styledDatasets = datasets.map((ds, i) => ({
    ...ds,
    backgroundColor: ds.backgroundColor || defaultColors[i % defaultColors.length] + 'cc',
    borderColor: ds.borderColor || defaultColors[i % defaultColors.length],
    borderWidth: 1,
    borderRadius: 6,
    borderSkipped: false,
    maxBarThickness: 40,
  }));

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: styledDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      scales: {
        x: {
          grid: { display: false },
          stacked,
          ticks: horizontal ? {
            callback: (val) => yPrefix + Number(val).toLocaleString('en-IN'),
          } : {},
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          stacked,
          ticks: !horizontal ? {
            callback: (val) => yPrefix + Number(val).toLocaleString('en-IN'),
          } : {},
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${yPrefix}${Number(ctx.parsed[horizontal ? 'x' : 'y']).toLocaleString('en-IN')}`,
          },
        },
      },
    },
  });

  return chartInstances[canvasId];
}
