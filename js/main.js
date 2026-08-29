// main.js - AI Bank Analyzer SPA Engine

// App State
let currentTab = 'home';
let transactions = [];
let summary = {};
let selectedCategoryFilter = 'all';
let currentEditingTxn = null;
let currentUser = null;

// Visual category styles mapping
const CATEGORY_STYLES = {
    'Food': { icon: 'fa-utensils', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    'Groceries': { icon: 'fa-basket-shopping', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    'Shopping': { icon: 'fa-bag-shopping', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
    'Travel': { icon: 'fa-plane', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    'Transport': { icon: 'fa-car', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    'Bills': { icon: 'fa-file-invoice-dollar', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    'Rent': { icon: 'fa-house-chimney', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    'Education': { icon: 'fa-graduation-cap', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' },
    'Entertainment': { icon: 'fa-ticket', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    'Health': { icon: 'fa-heart-pulse', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    'Other': { icon: 'fa-ellipsis', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' },
    'Salary': { icon: 'fa-wallet', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }
};

// Chart.js instances
let categoryChartInstance = null;
let trendChartInstance = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verify user session
    currentUser = await checkAuthSession();
    if (!currentUser) return; // auth.js will handle redirect
    
    // Display UI Content
    document.getElementById('mainAppContent').classList.remove('d-none');
    
    // Set Profile UI elements
    document.getElementById('profileMenuButton').textContent = currentUser.name[0].toUpperCase();
    document.getElementById('userNameHeader').textContent = `Logged in as ${currentUser.name}`;
    document.getElementById('profileBigInitial').textContent = currentUser.name[0].toUpperCase();
    document.getElementById('profileName').textContent = currentUser.name;
    document.getElementById('profileEmail').textContent = currentUser.email;

    // Set current date in header
    updateHeaderDate();
    
    // Fetch initial transactions & summary data
    fetchData();
    
    // Setup listeners
    setupEventListeners();
});

function updateHeaderDate() {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date();
    document.getElementById('currentDateDisplay').textContent = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

// Switch tabs in Single Page App layout
function switchTab(tabId) {
    // Hide all panes
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('d-none'));
    
    // Show active pane
    const activePane = document.getElementById(`tab-${tabId}`);
    if (activePane) {
        activePane.classList.remove('d-none');
    }
    
    // Update bottom nav active classes
    document.querySelectorAll('.bottom-nav .nav-item').forEach(el => el.classList.remove('active'));
    const navBtn = document.getElementById(`nav-${tabId}`);
    if (navBtn) {
        navBtn.classList.add('active');
    }
    
    // Update title
    const titles = {
        'home': 'Expenses',
        'history': 'History Log',
        'stats': 'Financial Stats',
        'profile': 'Profile & Insights'
    };
    document.getElementById('headerTitle').textContent = titles[tabId] || 'Expenses';
    
    currentTab = tabId;
    
    // Perform tab-specific refreshes
    if (tabId === 'stats') {
        renderCharts();
    } else if (tabId === 'profile') {
        fetchInsights();
    }
}

// Fetch all transactions and summary from APIs
async function fetchData() {
    try {
        // Fetch summary
        const summaryRes = await apiFetch('/api/summary');
        if (summaryRes) {
            summary = await summaryRes.json();
            updateSummaryDisplay();
        }

        // Fetch transactions
        const txnsRes = await apiFetch('/api/transactions');
        if (txnsRes) {
            transactions = await txnsRes.json();
            renderTransactions();
            renderHistoryTab();
        }
    } catch (err) {
        console.error("Data fetch error:", err);
    }
}

// Update summary card display on Home Tab
function updateSummaryDisplay() {
    const monthlyTotal = summary.total_expenses || 0;
    const transactionCount = summary.transaction_count || 0;
    
    document.getElementById('monthlyTotalDisplay').textContent = `₹${monthlyTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('monthlyCountDisplay').textContent = `${transactionCount} transaction${transactionCount === 1 ? '' : 's'} this month`;
}

// Render dynamic transactions list on HOME Tab
function renderTransactions() {
    const listContainer = document.getElementById('recentTransactionsList');
    const emptyState = document.getElementById('homeEmptyState');
    listContainer.innerHTML = '';
    
    // Filter transactions based on category filter
    const filteredTxns = transactions.filter(t => {
        if (selectedCategoryFilter === 'all') return true;
        return t.category === selectedCategoryFilter;
    });

    // Populate category filters horizontal scrollbar on Home Tab
    renderCategoryFiltersHorizontal();
    
    if (filteredTxns.length === 0) {
        emptyState.classList.remove('d-none');
        return;
    }
    emptyState.classList.add('d-none');

    // Take top 8 recent transactions for Home Tab
    filteredTxns.slice(0, 8).forEach(t => {
        const style = CATEGORY_STYLES[t.category] || CATEGORY_STYLES['Other'];
        const itemHtml = `
            <div class="transaction-item" onclick="editTransaction(${t.id})" oncontextmenu="handleLongPress(event, ${t.id})">
                <div class="transaction-item-left">
                    <div class="category-icon" style="background-color: ${style.bg}; color: ${style.color}">
                        <i class="fa-solid ${style.icon}"></i>
                    </div>
                    <div class="transaction-details">
                        <h6 class="text-white fw-bold mb-0">${t.description}</h6>
                        <p class="text-secondary">${t.payment_method} &middot; ${formatDateString(t.date)}</p>
                    </div>
                </div>
                <div class="transaction-item-right">
                    <span class="transaction-amount ${t.type.toLowerCase()}">
                        ${t.type === 'Income' ? '+' : '-'} ₹${t.amount.toFixed(2)}
                    </span>
                    <span class="d-block text-secondary small" style="font-size: 0.65rem;">${t.category}</span>
                </div>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', itemHtml);
    });
}

// Setup horizontal category scroll filters
function renderCategoryFiltersHorizontal() {
    const container = document.getElementById('categoryFilterContainer');
    const activeCategories = new Set(transactions.map(t => t.category));
    let html = `<button class="btn btn-sm btn-category-filter ${selectedCategoryFilter === 'all' ? 'active' : ''}" onclick="setCategoryFilter('all')">All</button>`;
    
    activeCategories.forEach(cat => {
        if (!cat) return;
        html += `<button class="btn btn-sm btn-category-filter ${selectedCategoryFilter === cat ? 'active' : ''}" onclick="setCategoryFilter('${cat}')">${cat}</button>`;
    });
    
    container.innerHTML = html;
}

function setCategoryFilter(category) {
    selectedCategoryFilter = category;
    renderTransactions();
}

// Render History tab items
function renderHistoryTab() {
    const searchVal = document.getElementById('historySearch').value.toLowerCase();
    const startDateVal = document.getElementById('historyStartDate').value;
    const endDateVal = document.getElementById('historyEndDate').value;
    
    const listContainer = document.getElementById('fullHistoryList');
    listContainer.innerHTML = '';
    
    const filtered = transactions.filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(searchVal) || t.category.toLowerCase().includes(searchVal);
        const matchesStart = startDateVal ? t.date >= startDateVal : true;
        const matchesEnd = endDateVal ? t.date <= endDateVal : true;
        return matchesSearch && matchesStart && matchesEnd;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `<div class="text-center text-secondary py-5">No transactions match filters.</div>`;
        return;
    }

    filtered.forEach(t => {
        const style = CATEGORY_STYLES[t.category] || CATEGORY_STYLES['Other'];
        const itemHtml = `
            <div class="transaction-item" onclick="editTransaction(${t.id})">
                <div class="transaction-item-left">
                    <div class="category-icon" style="background-color: ${style.bg}; color: ${style.color}">
                        <i class="fa-solid ${style.icon}"></i>
                    </div>
                    <div class="transaction-details">
                        <h6 class="text-white fw-bold mb-0">${t.description}</h6>
                        <p class="text-secondary">${t.payment_method} &middot; ${formatDateString(t.date)}</p>
                    </div>
                </div>
                <div class="transaction-item-right">
                    <span class="transaction-amount ${t.type.toLowerCase()}">
                        ${t.type === 'Income' ? '+' : '-'} ₹${t.amount.toFixed(2)}
                    </span>
                    <span class="d-block text-secondary small" style="font-size: 0.65rem;">${t.category}</span>
                </div>
            </div>
        `;
        listContainer.insertAdjacentHTML('beforeend', itemHtml);
    });
}

// Render financial graphs via Chart.js
function renderCharts() {
    const categoryData = summary.category_breakdown || {};
    const monthlyTrend = summary.monthly_trend || {};
    
    const catLabels = Object.keys(categoryData);
    const catValues = Object.values(categoryData);
    const catColors = catLabels.map(label => (CATEGORY_STYLES[label] || CATEGORY_STYLES['Other']).color);
    
    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }
    
    const catCtx = document.getElementById('categoryChart').getContext('2d');
    categoryChartInstance = new Chart(catCtx, {
        type: 'doughnut',
        data: {
            labels: catLabels,
            datasets: [{
                data: catValues,
                backgroundColor: catColors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', font: { family: 'Outfit', size: 11 } }
                }
            },
            cutout: '65%'
        }
    });

    const trendLabels = Object.keys(monthlyTrend).sort();
    const trendExpenses = trendLabels.map(label => monthlyTrend[label].expense);
    const trendIncomes = trendLabels.map(label => monthlyTrend[label].income);
    
    if (trendChartInstance) {
        trendChartInstance.destroy();
    }
    
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    trendChartInstance = new Chart(trendCtx, {
        type: 'bar',
        data: {
            labels: trendLabels,
            datasets: [
                {
                    label: 'Expenses',
                    data: trendExpenses,
                    backgroundColor: '#ec4899',
                    borderRadius: 6
                },
                {
                    label: 'Income',
                    data: trendIncomes,
                    backgroundColor: '#10b981',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
                y: { grid: { color: '#222633' }, ticks: { color: '#94a3b8' } }
            },
            plugins: {
                legend: {
                    labels: { color: '#94a3b8', font: { family: 'Outfit' } }
                }
            }
        }
    });

    const statsList = document.getElementById('statsList');
    statsList.innerHTML = '';
    
    const totalExpenses = summary.total_expenses || 1;
    const sortedCats = Object.entries(categoryData).sort((a, b) => b[1] - a[1]);
    
    if (sortedCats.length === 0) {
        statsList.innerHTML = '<div class="text-center text-secondary py-3">No stats data found.</div>';
        return;
    }
    
    sortedCats.forEach(([cat, amount]) => {
        const style = CATEGORY_STYLES[cat] || CATEGORY_STYLES['Other'];
        const percentage = ((amount / totalExpenses) * 100).toFixed(0);
        
        const cardHtml = `
            <div class="progress-list-item">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-bold text-white small"><i class="fa-solid ${style.icon} me-1" style="color: ${style.color}"></i> ${cat}</span>
                    <span class="text-white small fw-bold">₹${amount.toFixed(2)} (${percentage}%)</span>
                </div>
                <div class="progress progress-bar-sm bg-dark">
                    <div class="progress-bar" role="progressbar" style="width: ${percentage}%; background-color: ${style.color}"></div>
                </div>
            </div>
        `;
        statsList.insertAdjacentHTML('beforeend', cardHtml);
    });
}

// Fetch AI Financial Insights
async function fetchInsights() {
    const container = document.getElementById('aiInsightsContainer');
    container.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
            <span class="text-secondary small ms-2">Analyzing financial data...</span>
        </div>
    `;

    try {
        const res = await apiFetch('/api/ai/insights');
        if (!res) return;
        const data = await res.json();
        
        container.innerHTML = '';
        data.insights.forEach(insight => {
            const item = `
                <div class="insight-card">
                    <p class="text-white mb-0 small lh-base">${insight.replace(/\*(.*?)\*/g, '<strong>$1</strong>')}</p>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', item);
        });
    } catch (err) {
        console.error("AI Insights Error:", err);
        container.innerHTML = `<div class="text-center text-danger small">Unable to retrieve AI insights right now.</div>`;
    }
}

// SPA CSV Export triggers dynamic credentialed download
async function triggerCSVExport() {
    try {
        const response = await apiFetch('/api/export');
        if (!response) return;
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `expenses_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        alert("Export failed: " + err.message);
    }
}

// Open Form Modal for Creating Expense
function openAddModal() {
    currentEditingTxn = null;
    document.getElementById('modalTitle').textContent = 'Add Expense';
    document.getElementById('txnId').value = '';
    document.getElementById('expenseForm').reset();
    setTodayDate();
    
    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('selected'));
    const otherItem = document.querySelector('.category-item[data-category="Other"]');
    if (otherItem) otherItem.classList.add('selected');
    
    const modal = new bootstrap.Modal(document.getElementById('addExpenseModal'));
    modal.show();
}

// Set Today Date in input field
function setTodayDate() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    document.getElementById('date').value = `${d.getFullYear()}-${month}-${day}`;
}

// Load transaction data into modal for edits
function editTransaction(id) {
    const txn = transactions.find(t => t.id === id);
    if (!txn) return;
    
    currentEditingTxn = txn;
    
    document.getElementById('modalTitle').textContent = 'Edit Transaction';
    document.getElementById('txnId').value = txn.id;
    document.getElementById('txnType').value = txn.type;
    document.getElementById('amount').value = txn.amount;
    document.getElementById('description').value = txn.description;
    document.getElementById('date').value = txn.date;
    document.getElementById('paymentMethod').value = txn.payment_method;
    document.getElementById('notes').value = txn.notes || '';
    
    document.querySelectorAll('.category-item').forEach(el => el.classList.remove('selected'));
    const catItem = document.querySelector(`.category-item[data-category="${txn.category}"]`);
    if (catItem) {
        catItem.classList.add('selected');
    }
    
    const modal = new bootstrap.Modal(document.getElementById('addExpenseModal'));
    modal.show();
}

// Right click or long press deletes transactions
async function handleLongPress(e, id) {
    e.preventDefault();
    if (confirm("Are you sure you want to delete this transaction?")) {
        try {
            const res = await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
            if (res) fetchData();
        } catch (err) {
            console.error("Deletion error:", err);
        }
    }
}

// Helper: evaluation of mathematical expressions (e.g. 20+30+40)
function evaluateAmountExpression(val) {
    const sanitized = val.replace(/[^0-9+\-*/().]/g, '');
    try {
        const result = Function(`"use strict"; return (${sanitized})`)();
        return isNaN(result) || result === Infinity ? 0 : parseFloat(result);
    } catch (e) {
        return 0;
    }
}

// Add amount helpers (+10, +20 etc)
function addToAmount(num) {
    const amountInput = document.getElementById('amount');
    let curVal = amountInput.value.trim();
    if (!curVal || curVal === '0') {
        amountInput.value = num;
    } else {
        if (/[\+\-\*\/]$/.test(curVal)) {
            amountInput.value = curVal + num;
        } else {
            amountInput.value = curVal + '+' + num;
        }
    }
}

// Trigger AI parsing on Description input blur or button press
async function triggerAICategorization() {
    const descInput = document.getElementById('description');
    const text = descInput.value.trim();
    if (!text) return;
    
    try {
        const res = await apiFetch('/api/ai/categorize', {
            method: 'POST',
            body: { text }
        });
        if (!res) return;
        const data = await res.json();
        
        if (data.amount > 0) {
            document.getElementById('amount').value = data.amount;
        }
        if (data.category) {
            document.querySelectorAll('.category-item').forEach(el => el.classList.remove('selected'));
            const catItem = document.querySelector(`.category-item[data-category="${data.category}"]`);
            if (catItem) catItem.classList.add('selected');
        }
        if (data.type) {
            document.getElementById('txnType').value = data.type;
        }
        if (data.payment_method) {
            document.getElementById('paymentMethod').value = data.payment_method;
        }
        if (data.description) {
            descInput.value = data.description;
        }
    } catch (err) {
        console.error("AI categorization error:", err);
    }
}

// Simulate Voice Input expense logging
function simulateVoiceInput() {
    const messages = [
        "I spent 450 rupees for swiggy food delivery",
        "Salary of 45000 credited",
        "Spent 1500 for rent",
        "Petrol refill 750 rupees in UPI",
        "Bought ticket for movie ticket 350",
        "Grocery shopping blinkit 640"
    ];
    const randomMsg = messages[Math.floor(Math.random() * messages.length)];
    
    const descInput = document.getElementById('description');
    descInput.value = "Listening...";
    
    setTimeout(() => {
        descInput.value = randomMsg;
        triggerAICategorization();
    }, 1500);
}

// Simulate OCR scan progress bar and details parsing
function simulateOCR(input) {
    if (!input.files || !input.files[0]) return;
    
    const progressDiv = document.getElementById('ocrProgress');
    const statusText = document.getElementById('ocrStatusText');
    const bar = document.getElementById('ocrProgressBar');
    
    progressDiv.classList.remove('d-none');
    bar.style.width = '0%';
    statusText.textContent = "Uploading receipt image...";
    
    let pct = 0;
    const interval = setInterval(() => {
        pct += 10;
        bar.style.width = pct + '%';
        
        if (pct === 30) statusText.textContent = "Analyzing receipt text layout...";
        if (pct === 60) statusText.textContent = "Extracting merchant details & taxes...";
        if (pct === 90) statusText.textContent = "Categorizing and finalizing transaction...";
        
        if (pct >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                progressDiv.classList.add('d-none');
                
                const mockReceipts = [
                    { desc: "Starbucks Coffee", amount: 480.00, cat: "Food", notes: "Mock OCR: Receipt scanned from Starbucks Store" },
                    { desc: "Instamart Groceries", amount: 1240.50, cat: "Groceries", notes: "Mock OCR: Blinkit Delivery Invoice" },
                    { desc: "Zara Jacket", amount: 4999.00, cat: "Shopping", notes: "Mock OCR: Zara Retail Outlet Invoice" },
                    { desc: "HP Fuel Station", amount: 1500.00, cat: "Transport", notes: "Mock OCR: Petrol pump fuel card transaction receipt" }
                ];
                
                const select = mockReceipts[Math.floor(Math.random() * mockReceipts.length)];
                
                document.getElementById('description').value = select.desc;
                document.getElementById('amount').value = select.amount;
                document.getElementById('notes').value = select.notes;
                document.getElementById('paymentMethod').value = "Credit Card";
                
                document.querySelectorAll('.category-item').forEach(el => el.classList.remove('selected'));
                const catItem = document.querySelector(`.category-item[data-category="${select.cat}"]`);
                if (catItem) catItem.classList.add('selected');
                
                alert("Receipt scanned successfully!");
            }, 500);
        }
    }, 200);
}

// Set up UI Event listeners
function setupEventListeners() {
    document.getElementById('historySearch').addEventListener('input', renderHistoryTab);
    document.getElementById('historyStartDate').addEventListener('change', renderHistoryTab);
    document.getElementById('historyEndDate').addEventListener('change', renderHistoryTab);
    
    document.getElementById('clearFiltersBtn').addEventListener('click', () => {
        document.getElementById('historySearch').value = '';
        document.getElementById('historyStartDate').value = '';
        document.getElementById('historyEndDate').value = '';
        renderHistoryTab();
    });

    document.getElementById('categoryGrid').addEventListener('click', (e) => {
        const item = e.target.closest('.category-item');
        if (!item) return;
        
        document.querySelectorAll('.category-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        
        const cat = item.dataset.category;
        if (cat === 'Salary') {
            document.getElementById('txnType').value = 'Income';
        } else {
            document.getElementById('txnType').value = 'Expense';
        }
    });

    document.getElementById('description').addEventListener('blur', () => {
        if (!document.getElementById('amount').value.trim()) {
            triggerAICategorization();
        }
    });

    const refreshBtn = document.getElementById('refreshInsightsBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', fetchInsights);
    }

    document.querySelectorAll('.stats-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.stats-toggle-btn').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            
            const chartType = e.target.dataset.chart;
            if (chartType === 'category') {
                document.getElementById('categoryChartContainer').classList.remove('d-none');
                document.getElementById('trendChartContainer').classList.add('d-none');
            } else {
                document.getElementById('categoryChartContainer').classList.add('d-none');
                document.getElementById('trendChartContainer').classList.remove('d-none');
            }
        });
    });

    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rawAmount = document.getElementById('amount').value;
        const amount = evaluateAmountExpression(rawAmount);
        
        if (amount <= 0) {
            alert("Please enter a valid amount expression (e.g. 50 or 20+30).");
            return;
        }

        const selectedCatEl = document.querySelector('.category-item.selected');
        const category = selectedCatEl ? selectedCatEl.dataset.category : 'Other';
        
        const payload = {
            amount: amount,
            description: document.getElementById('description').value,
            date: document.getElementById('date').value,
            payment_method: document.getElementById('paymentMethod').value,
            type: document.getElementById('txnType').value,
            category: category,
            notes: document.getElementById('notes').value
        };

        const txnId = document.getElementById('txnId').value;
        const method = txnId ? 'PUT' : 'POST';
        const url = txnId ? `/api/transactions/${txnId}` : '/api/transactions';

        try {
            const res = await apiFetch(url, {
                method: method,
                body: payload
            });
            
            if (res) {
                // Close Modal
                const modalEl = document.getElementById('addExpenseModal');
                const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                modal.hide();
                
                // Refresh data
                fetchData();
            }
        } catch (err) {
            console.error("Transaction save error:", err);
            alert("Failed to save transaction: " + err.message);
        }
    });
}

function formatDateString(dateStr) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
}

async function logoutUser() {
    try {
        const response = await apiFetch('/api/auth/logout', { method: 'POST' });
        if (response) {
            window.location.href = "login.html";
        }
    } catch (err) {
        console.error("Logout failed:", err);
        window.location.href = "login.html";
    }
}
