// Configuration for API Base
// Keep this environment-friendly. When developing locally, use localhost.
// When deploying, change to your production backend URL.
const API_BASE = 'http://127.0.0.1:5000';

// Global Chart Instances
let forecastChartInst = null;
let convergenceChartInst = null;

// DOM Elements
const productSelect = document.getElementById('product_id');
const optimizeForm = document.getElementById('optimize-form');
const submitBtn = document.getElementById('submit-btn');

const kpiRop = document.querySelector('#kpi-rop .kpi-value');
const kpiEoq = document.querySelector('#kpi-eoq .kpi-value');
const kpiDecision = document.querySelector('#kpi-decision .kpi-value');
const kpiAccuracy = document.querySelector('#kpi-accuracy .kpi-value');

// Music Player Logic
const bgAudio = document.getElementById('bg-audio');
bgAudio.volume = 0.3; // Increased as requested
const playBtn = document.getElementById('play-pause-btn');
const recordWrapper = document.querySelector('.record-wrapper');
let isPlaying = false;

playBtn.addEventListener('click', () => {
    if (isPlaying) {
        bgAudio.pause();
        recordWrapper.classList.remove('playing');
        // change icon to play
        playBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    } else {
        bgAudio.play().catch(e => {
            console.log("Audio not set or cannot play auto:", e);
            alert("No song loaded! Add an MP3 to <audio id='bg-audio'> in index.html");
        });
        recordWrapper.classList.add('playing');
        // change icon to pause
        playBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
    }
    isPlaying = !isPlaying;
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    Chart.defaults.font.family = "'Hanken Grotesk', sans-serif";
    Chart.defaults.color = '#785449';
});

// Fetch Top 20 Products
async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE}/api/products`);
        if (!response.ok) throw new Error("Failed to fetch products");
        
        const products = await response.json();
        
        // Clear select
        productSelect.innerHTML = '<option value="" disabled selected>Select a Product...</option>';
        
        if (products.length === 0) {
            const opt = document.createElement('option');
            opt.textContent = "No products found";
            productSelect.appendChild(opt);
            return;
        }

        products.forEach((product, index) => {
            const opt = document.createElement('option');
            opt.value = product.id;
            opt.textContent = `${product.name} (Code: ${product.id})`;
            productSelect.appendChild(opt);
        });
    } catch (error) {
        console.error("Error loading products:", error);
        productSelect.innerHTML = '<option value="" disabled selected>Error loading products</option>';
    }
}

// Handle Form Submission
optimizeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Set loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    const payload = {
        product_id: productSelect.value,
        lead_time_days: parseFloat(document.getElementById('lead_time_days').value),
        holding_cost: parseFloat(document.getElementById('holding_cost').value),
        ordering_cost: parseFloat(document.getElementById('ordering_cost').value),
        stockout_cost: parseFloat(document.getElementById('stockout_cost').value),
    };

    try {
        const response = await fetch(`${API_BASE}/api/optimize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Failed to optimize");
        }

        updateDashboard(data);

    } catch (error) {
        console.error("Optimization error:", error);
        alert(`Error: ${error.message}`);
    } finally {
        // Reset loading state
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
});

function updateDashboard(data) {
    // 1. Update KPIs
    kpiRop.textContent = data.reorder_point.toFixed(2);
    kpiEoq.textContent = data.optimal_order_qty.toFixed(2);
    
    // Accuracy text
    kpiAccuracy.textContent = `${data.accuracy.toFixed(2)}%`;
    
    // Decision Text & Styling
    kpiDecision.textContent = data.decision;
    kpiDecision.className = 'kpi-value'; // reset
    if (data.decision === "Reorder Now") {
        kpiDecision.classList.add('decision-reorder');
    } else {
        kpiDecision.classList.add('decision-okay');
    }

    // Update Summary
    const summaryEl = document.getElementById('optimization-summary');
    const decisionClass = data.decision === 'Reorder Now' ? 'decision-reorder' : 'decision-okay';
    summaryEl.innerHTML = `Based on the historical data and <strong>${data.accuracy.toFixed(2)}%</strong> accurate forecasting, the optimal time to reorder is when the stock falls to <strong>${data.reorder_point.toFixed(2)}</strong> units. To minimize your total holding and ordering costs, we recommend ordering <strong>${data.optimal_order_qty.toFixed(2)}</strong> units per batch. Based on your current estimation, the system decision is: <strong class="${decisionClass}">${data.decision}</strong>.`;

    // 2. Render Forecast Chart
    renderForecastChart(data.forecast_dates, data.forecast);

    // 3. Render Convergence Chart
    renderConvergenceChart(data.convergence);
}

function renderForecastChart(labels, dataPoints) {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    
    if (forecastChartInst) {
        forecastChartInst.destroy();
    }

    const duration = 1500;
    const delayBetweenPoints = duration / dataPoints.length;
    const previousY = (ctx) => ctx.index === 0 ? ctx.chart.scales.y.getPixelForValue(0) : ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.index - 1].getProps(['y'], true).y;

    forecastChartInst = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Forecasted Demand',
                data: dataPoints,
                borderColor: '#ff2c47', // accent-1
                backgroundColor: 'rgba(255, 44, 71, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#fffcf5',
                pointBorderColor: '#ff2c47',
                pointRadius: 3,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.4 // Smooth curves
            }]
        },
        options: {
            animation: {
                x: {
                    type: 'number',
                    easing: 'linear',
                    duration: delayBetweenPoints,
                    from: NaN,
                    delay(ctx) {
                        if (ctx.type !== 'data' || ctx.xStarted) return 0;
                        ctx.xStarted = true;
                        return ctx.index * delayBetweenPoints;
                    }
                },
                y: {
                    type: 'number',
                    easing: 'linear',
                    duration: delayBetweenPoints,
                    from: previousY,
                    delay(ctx) {
                        if (ctx.type !== 'data' || ctx.yStarted) return 0;
                        ctx.yStarted = true;
                        return ctx.index * delayBetweenPoints;
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#511f20',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    cornerRadius: 8,
                    padding: 10
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxTicksLimit: 7 }
                },
                y: {
                    grid: { color: 'rgba(229, 222, 206, 0.4)' },
                    beginAtZero: true
                }
            }
        }
    });
}

function renderConvergenceChart(convergenceData) {
    const ctx = document.getElementById('convergenceChart').getContext('2d');
    
    if (convergenceChartInst) {
        convergenceChartInst.destroy();
    }

    // Generate iteration labels [1, 2, ..., n]
    const labels = Array.from({length: convergenceData.length}, (_, i) => i + 1);

    const duration = 2500;
    const delayBetweenPoints = duration / convergenceData.length;
    const previousY = (ctx) => ctx.index === 0 ? ctx.chart.scales.y.getPixelForValue(0) : ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.index - 1].getProps(['y'], true).y;

    convergenceChartInst = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Global Best Fitness Core',
                data: convergenceData,
                borderColor: '#785449', // subtext color
                borderWidth: 2,
                pointRadius: 0, // No points for a smooth descent line
                pointHoverRadius: 4,
                tension: 0.1
            }]
        },
        options: {
            animation: {
                x: {
                    type: 'number',
                    easing: 'linear',
                    duration: delayBetweenPoints,
                    from: NaN,
                    delay(ctx) {
                        if (ctx.type !== 'data' || ctx.xStarted) return 0;
                        ctx.xStarted = true;
                        return ctx.index * delayBetweenPoints;
                    }
                },
                y: {
                    type: 'number',
                    easing: 'linear',
                    duration: delayBetweenPoints,
                    from: previousY,
                    delay(ctx) {
                        if (ctx.type !== 'data' || ctx.yStarted) return 0;
                        ctx.yStarted = true;
                        return ctx.index * delayBetweenPoints;
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#511f20',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    cornerRadius: 8,
                    padding: 10
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    title: { display: true, text: 'Iterations' },
                    ticks: { maxTicksLimit: 10 }
                },
                y: {
                    grid: { color: 'rgba(229, 222, 206, 0.4)' },
                    title: { display: true, text: 'Total Cost Fitness' },
                }
            }
        }
    });
}
