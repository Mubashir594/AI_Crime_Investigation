console.log("SOC Dashboard JS loaded successfully");

const ctx = document.getElementById('detectionChart');

if (ctx) {
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Faces Detected',
                data: [12, 19, 7, 15, 22, 18, 25],
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#cbd5e1' }
                },
                y: {
                    ticks: { color: '#cbd5e1' }
                }
            }
        }
    });
}
// Placeholder for future real-time logs
function addLog(time, source, event, status) {
    const tbody = document.getElementById('logsTableBody');
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${time}</td>
        <td>${source}</td>
        <td>${event}</td>
        <td><span class="badge bg-warning">${status}</span></td>
    `;
    tbody.prepend(row);
}
