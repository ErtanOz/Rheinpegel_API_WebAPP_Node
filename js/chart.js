/**
 * Water Level Chart Module
 * Manages Chart.js visualization for historical water level data
 */

class WaterLevelChart {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.chart = null;
    this.maxDataPoints = 144; // 24 hours with 10-minute intervals
  }

  /**
   * Initialize the chart with historical data
   * @param {Array} historicalData - Array of water level readings
   */
  initialize(historicalData = []) {
    if (!this.canvas) {
      console.error('Canvas element not found');
      return;
    }

    const ctx = this.canvas.getContext('2d');
    
    // Prepare chart data
    const chartData = this.prepareChartData(historicalData);

    // Create chart
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [
          {
            label: 'Wasserstand (cm)',
            data: chartData.values,
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#2196F3',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          },
          {
            label: 'Warnstufe (400 cm)',
            data: chartData.warningLine,
            borderColor: '#FF9800',
            borderDash: [10, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            tension: 0
          },
          {
            label: 'Gefahrstufe (800 cm)',
            data: chartData.dangerLine,
            borderColor: '#F44336',
            borderDash: [10, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
            tension: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            enabled: true,
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            },
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += context.parsed.y + ' cm';
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'hour',
              displayFormats: {
                hour: 'HH:mm',
                day: 'dd.MM'
              },
              tooltipFormat: 'dd.MM.yyyy HH:mm'
            },
            title: {
              display: true,
              text: 'Zeit',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              maxRotation: 45,
              minRotation: 0
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Wasserstand (cm)',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.1)'
            },
            ticks: {
              callback: function(value) {
                return value + ' cm';
              }
            }
          }
        },
        animation: {
          duration: 750,
          easing: 'easeInOutQuart'
        }
      }
    });

    console.log('Chart initialized with', historicalData.length, 'data points');
  }

  /**
   * Update chart with new data point
   * @param {Object} newData - New water level reading
   */
  updateChart(newData) {
    if (!this.chart) {
      console.error('Chart not initialized');
      return;
    }

    const dataset = this.chart.data.datasets[0];
    
    // Add new data point
    this.chart.data.labels.push(new Date(newData.timestamp));
    dataset.data.push(newData.waterLevel);

    // Update threshold lines to match new length
    const dataLength = this.chart.data.labels.length;
    this.chart.data.datasets[1].data = Array(dataLength).fill(400);
    this.chart.data.datasets[2].data = Array(dataLength).fill(800);

    // Remove old data points if exceeding max
    if (this.chart.data.labels.length > this.maxDataPoints) {
      const removeCount = this.chart.data.labels.length - this.maxDataPoints;
      this.chart.data.labels.splice(0, removeCount);
      dataset.data.splice(0, removeCount);
      this.chart.data.datasets[1].data.splice(0, removeCount);
      this.chart.data.datasets[2].data.splice(0, removeCount);
    }

    // Update chart
    this.chart.update('none'); // Update without animation for smooth real-time updates

    console.log('Chart updated with new data point:', newData.waterLevel, 'cm');
  }

  /**
   * Refresh chart with new historical data
   * @param {Array} historicalData - Array of water level readings
   */
  refreshChart(historicalData) {
    if (!this.chart) {
      this.initialize(historicalData);
      return;
    }

    const chartData = this.prepareChartData(historicalData);
    
    this.chart.data.labels = chartData.labels;
    this.chart.data.datasets[0].data = chartData.values;
    this.chart.data.datasets[1].data = chartData.warningLine;
    this.chart.data.datasets[2].data = chartData.dangerLine;
    
    this.chart.update();

    console.log('Chart refreshed with', historicalData.length, 'data points');
  }

  /**
   * Prepare data for chart
   * @param {Array} historicalData - Raw historical data
   * @returns {Object} Formatted chart data
   */
  prepareChartData(historicalData) {
    const labels = [];
    const values = [];
    
    // Sort by timestamp (oldest first)
    const sortedData = [...historicalData].sort((a, b) => a.timestamp - b.timestamp);
    
    // Extract labels and values
    sortedData.forEach(reading => {
      labels.push(new Date(reading.timestamp));
      values.push(reading.waterLevel);
    });

    // Create threshold lines matching data length
    const dataLength = labels.length;
    const warningLine = Array(dataLength).fill(400);
    const dangerLine = Array(dataLength).fill(800);

    return {
      labels,
      values,
      warningLine,
      dangerLine
    };
  }

  /**
   * Highlight alert zones on chart
   * @param {number} currentLevel - Current water level
   */
  highlightAlertZone(currentLevel) {
    if (!this.chart) return;

    const dataset = this.chart.data.datasets[0];
    
    // Change line color based on current level
    if (currentLevel >= 800) {
      dataset.borderColor = '#F44336';
      dataset.backgroundColor = 'rgba(244, 67, 54, 0.1)';
    } else if (currentLevel >= 400) {
      dataset.borderColor = '#FF9800';
      dataset.backgroundColor = 'rgba(255, 152, 0, 0.1)';
    } else {
      dataset.borderColor = '#2196F3';
      dataset.backgroundColor = 'rgba(33, 150, 243, 0.1)';
    }

    this.chart.update('none');
  }

  /**
   * Destroy chart instance
   */
  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
      console.log('Chart destroyed');
    }
  }

  /**
   * Get chart instance
   * @returns {Chart} Chart.js instance
   */
  getChart() {
    return this.chart;
  }

  /**
   * Export chart as image
   * @returns {string} Base64 encoded image
   */
  exportAsImage() {
    if (!this.chart) return null;
    return this.canvas.toDataURL('image/png');
  }
}