document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('calc-form');
    const redTypeSelect = document.getElementById('redundancy-type');
    const distTypeSelect = document.getElementById('dist-type');
    
    // UI elements
    const expInputs = document.getElementById('exponential-inputs');
    const weiInputs = document.getElementById('weibull-inputs');
    const switchInputs = document.getElementById('switch-inputs');
    const warmOnlyInputs = document.querySelectorAll('.warm-only');
    
    let chartInstance = null;

    // Handle UI toggles
    function updateUI() {
        const dType = distTypeSelect.value;
        
        // Distribution inputs
        if (dType === 'exponential') {
            expInputs.style.display = 'block';
            weiInputs.style.display = 'none';
        } else {
            expInputs.style.display = 'none';
            weiInputs.style.display = 'block';
        }
        
        calculateAndPlot();
    }
    
    distTypeSelect.addEventListener('change', updateUI);
    form.addEventListener('input', calculateAndPlot);
    
    function calculateAndPlot() {
        const dType = distTypeSelect.value;
        const n = parseInt(document.getElementById('component-count').value) || 2;
        const t_max = parseFloat(document.getElementById('mission-time').value) || 10000;
        const R_sw = parseFloat(document.getElementById('switch-reliability').value) || 1.0;
        
        const N_steps = 500;
        const dt = t_max / N_steps;
        let t_arr = [];
        let R1_arr = [];
        let f1_arr = [];
        
        // Distribution Parameters
        let lambda_active = 0, lambda_stby = 0;
        let beta = 1, eta = 1, AF = 1;
        
        if (dType === 'exponential') {
            lambda_active = parseFloat(document.getElementById('lambda-active').value) || 0;
            lambda_stby = parseFloat(document.getElementById('lambda-stby').value) || 0;
        } else {
            beta = parseFloat(document.getElementById('weibull-beta').value) || 1;
            eta = parseFloat(document.getElementById('weibull-eta').value) || 1;
            AF = parseFloat(document.getElementById('weibull-af').value) || 1;
        }
        
        // Compute base arrays (Single Component)
        for (let i = 0; i <= N_steps; i++) {
            let t = i * dt;
            t_arr.push(t);
            let r = 1;
            let f = 0;
            if (dType === 'exponential') {
                r = Math.exp(-lambda_active * t);
                f = lambda_active * r;
            } else {
                if (t === 0) {
                    r = 1;
                    f = 0;
                } else {
                    r = Math.exp(-Math.pow(t / eta, beta));
                    f = (beta / eta) * Math.pow(t / eta, beta - 1) * r;
                }
            }
            R1_arr.push(r);
            f1_arr.push(f);
        }
        
        let R_series = new Array(N_steps + 1).fill(0);
        let R_parallel = new Array(N_steps + 1).fill(0);
        
        // Series and Parallel
        for (let i = 0; i <= N_steps; i++) {
            R_series[i] = Math.pow(R1_arr[i], n);
            R_parallel[i] = 1 - Math.pow(1 - R1_arr[i], n);
        }

        // Standby Calculations (Cold & Warm, Perfect & Imperfect)
        let R_cold_perf = [...R1_arr], f_cold_perf = [...f1_arr];
        let R_cold_imp = [...R1_arr], f_cold_imp = [...f1_arr];
        let R_warm_perf = [...R1_arr], f_warm_perf = [...f1_arr];
        let R_warm_imp = [...R1_arr], f_warm_imp = [...f1_arr];
        
        for (let k = 1; k < n; k++) {
            let R_next_cp = new Array(N_steps + 1).fill(0), f_next_cp = new Array(N_steps + 1).fill(0);
            let R_next_ci = new Array(N_steps + 1).fill(0), f_next_ci = new Array(N_steps + 1).fill(0);
            let R_next_wp = new Array(N_steps + 1).fill(0), f_next_wp = new Array(N_steps + 1).fill(0);
            let R_next_wi = new Array(N_steps + 1).fill(0), f_next_wi = new Array(N_steps + 1).fill(0);
            
            for (let i = 0; i <= N_steps; i++) {
                R_next_cp[i] = R_cold_perf[i];
                R_next_ci[i] = R_cold_imp[i];
                R_next_wp[i] = R_warm_perf[i];
                R_next_wi[i] = R_warm_imp[i];
                
                let i_R_cp = 0, i_f_cp = 0;
                let i_R_ci = 0, i_f_ci = 0;
                let i_R_wp = 0, i_f_wp = 0;
                let i_R_wi = 0, i_f_wi = 0;
                
                for (let j = 0; j <= i; j++) {
                    let x = j * dt;
                    let t_remain = t_arr[i] - x;
                    let weight = (j === 0 || j === i) ? 0.5 : 1.0;
                    
                    // Active parameters for Cold Standby
                    let R_act_c = R1_arr[i - j];
                    let f_act_c = f1_arr[i - j];
                    
                    // Cold Perfect
                    let f_x_cp = f_cold_perf[j];
                    i_R_cp += f_x_cp * 1.0 * R_act_c * weight * dt;
                    i_f_cp += f_x_cp * 1.0 * f_act_c * weight * dt;
                    
                    // Cold Imperfect
                    let f_x_ci = f_cold_imp[j];
                    i_R_ci += f_x_ci * R_sw * R_act_c * weight * dt;
                    i_f_ci += f_x_ci * R_sw * f_act_c * weight * dt;
                    
                    // Active parameters for Warm Standby
                    let R_stby_survive = 1;
                    let R_act_w = 1;
                    let f_act_w = 0;
                    
                    if (dType === 'exponential') {
                        R_stby_survive = Math.exp(-lambda_stby * x);
                        R_act_w = Math.exp(-lambda_active * t_remain);
                        f_act_w = lambda_active * R_act_w;
                    } else {
                        let t_e = x / AF;
                        let R_t_e = Math.exp(-Math.pow(t_e / eta, beta));
                        R_stby_survive = R_t_e; 
                        
                        if (R_t_e > 0) {
                            R_act_w = Math.exp(-Math.pow((t_remain + t_e) / eta, beta)) / R_t_e;
                            f_act_w = ((beta / eta) * Math.pow((t_remain + t_e) / eta, beta - 1) * Math.exp(-Math.pow((t_remain + t_e) / eta, beta))) / R_t_e;
                        } else {
                            R_act_w = 0;
                            f_act_w = 0;
                        }
                    }
                    
                    // Warm Perfect
                    let f_x_wp = f_warm_perf[j];
                    i_R_wp += f_x_wp * 1.0 * R_stby_survive * R_act_w * weight * dt;
                    i_f_wp += f_x_wp * 1.0 * R_stby_survive * f_act_w * weight * dt;
                    
                    // Warm Imperfect
                    let f_x_wi = f_warm_imp[j];
                    i_R_wi += f_x_wi * R_sw * R_stby_survive * R_act_w * weight * dt;
                    i_f_wi += f_x_wi * R_sw * R_stby_survive * f_act_w * weight * dt;
                }
                
                R_next_cp[i] += i_R_cp; f_next_cp[i] = i_f_cp;
                R_next_ci[i] += i_R_ci; f_next_ci[i] = i_f_ci;
                R_next_wp[i] += i_R_wp; f_next_wp[i] = i_f_wp;
                R_next_wi[i] += i_R_wi; f_next_wi[i] = i_f_wi;
            }
            R_cold_perf = R_next_cp; f_cold_perf = f_next_cp;
            R_cold_imp = R_next_ci; f_cold_imp = f_next_ci;
            R_warm_perf = R_next_wp; f_warm_perf = f_next_wp;
            R_warm_imp = R_next_wi; f_warm_imp = f_next_wi;
        }
        
        // Ensure bounds
        const sanitize = (arr) => {
            for(let i=0; i<arr.length; i++) {
                if(arr[i] > 1) arr[i] = 1;
                if(arr[i] < 0) arr[i] = 0;
            }
        };
        sanitize(R_series);
        sanitize(R_parallel);
        sanitize(R_cold_perf);
        sanitize(R_cold_imp);
        sanitize(R_warm_perf);
        sanitize(R_warm_imp);

        document.getElementById('res-single').innerText = (R1_arr[N_steps] * 100).toFixed(2) + '%';
        document.getElementById('res-series').innerText = (R_series[N_steps] * 100).toFixed(2) + '%';
        document.getElementById('res-parallel').innerText = (R_parallel[N_steps] * 100).toFixed(2) + '%';
        document.getElementById('res-cold-perf').innerText = (R_cold_perf[N_steps] * 100).toFixed(2) + '%';
        document.getElementById('res-cold-imperf').innerText = (R_cold_imp[N_steps] * 100).toFixed(2) + '%';
        document.getElementById('res-warm-perf').innerText = (R_warm_perf[N_steps] * 100).toFixed(2) + '%';
        document.getElementById('res-warm-imperf').innerText = (R_warm_imp[N_steps] * 100).toFixed(2) + '%';
        
        drawChart(t_arr, R1_arr, R_series, R_parallel, R_cold_perf, R_cold_imp, R_warm_perf, R_warm_imp);
    }
    
    function drawChart(labels, dSingle, dSeries, dParallel, dColdPerf, dColdImp, dWarmPerf, dWarmImp) {
        const ctx = document.getElementById('reliabilityChart').getContext('2d');
        if (chartInstance) {
            chartInstance.destroy();
        }
        
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.map(l => l.toFixed(1)),
                datasets: [
                    {
                        label: '單一元件',
                        data: dSingle,
                        borderColor: '#94a3b8',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: '串聯 (Series)',
                        data: dSeries,
                        borderColor: '#ef4444', // Red
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: '並聯 (Parallel)',
                        data: dParallel,
                        borderColor: '#10b981', // Green
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: '冷備用 (Cold Perfect)',
                        data: dColdPerf,
                        borderColor: '#3b82f6', // Blue
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: '冷備用 (Cold Imperfect)',
                        data: dColdImp,
                        borderColor: '#60a5fa', // Light Blue
                        borderDash: [3, 3],
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: '溫備用 (Warm Perfect)',
                        data: dWarmPerf,
                        borderColor: '#f59e0b', // Yellow/Orange
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: '溫備用 (Warm Imperfect)',
                        data: dWarmImp,
                        borderColor: '#fbbf24', // Light Yellow/Orange
                        borderDash: [3, 3],
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                scales: {
                    x: {
                        title: { display: true, text: '時間 (t)', color: '#94a3b8' },
                        ticks: { color: '#94a3b8', maxTicksLimit: 10 },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        title: { display: true, text: '可靠度 R(t)', color: '#94a3b8' },
                        min: 0,
                        max: 1,
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#f8fafc' } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + (context.parsed.y * 100).toFixed(2) + '%';
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Initial calculation on load
    updateUI();
});
