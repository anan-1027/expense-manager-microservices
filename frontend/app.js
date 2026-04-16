const API_URL = ''; // using relative paths since served by nginx

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    refreshAllData();
    // Periodically update stats
    setInterval(updateStats, 10000);
});

// --- UI Helpers ---
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message || 'Data stored successfully!';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

async function refreshCategories() {
    try {
        const response = await fetch(`${API_URL}/categories`);
        const categories = await response.json();
        const select = document.getElementById('expense-category');
        
        // Keep the first default option
        const defaultValue = select.options[0].outerHTML;
        select.innerHTML = defaultValue + categories.map(c => 
            `<option value="${c.name}">${c.name} (${c.type})</option>`
        ).join('');
    } catch (err) {
        console.error('Error fetching categories:', err);
    }
}

// --- Data Fetching ---
async function refreshAllData() {
    fetchData('users', 'users-result');
    fetchData('expenses', 'expenses-result');
    fetchData('budgets', 'budgets-result');
    fetchData('categories', 'categories-result');
    fetchData('reports', 'reports-result');
    refreshCategories();
    updateStats();
}

async function updateStats() {
    try {
        const [bRes, eRes, uRes] = await Promise.all([
            fetch(`${API_URL}/budgets`),
            fetch(`${API_URL}/expenses`),
            fetch(`${API_URL}/users`)
        ]);
        
        const budgets = await bRes.json();
        const expenses = await eRes.json();
        const users = await uRes.json();

        const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(b.limit || 0), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

        document.getElementById('stat-budget').textContent = `₹${totalBudget.toLocaleString('en-IN')}`;
        document.getElementById('stat-expenses').textContent = `₹${totalExpenses.toLocaleString('en-IN')}`;
        document.getElementById('stat-users').textContent = users.length.toLocaleString('en-IN');
    } catch (err) {
        console.error('Error updating stats:', err);
    }
}

async function fetchData(endpoint, resultElementId) {
    const resultDiv = document.getElementById(resultElementId);
    if (!resultDiv) return;

    try {
        const response = await fetch(`${API_URL}/${endpoint}`);
        const data = await response.json();
        
        if (data.length === 0) {
            resultDiv.innerHTML = '<div style="padding:0.5rem;color:#94a3b8;font-size:0.8rem">No records.</div>';
            return;
        }

        renderData(endpoint, data, resultDiv);
    } catch (err) {
        resultDiv.innerHTML = `<div style="padding:0.5rem;color:var(--danger)">Error: ${err.message}</div>`;
    }
}

function renderData(endpoint, data, container) {
    container.innerHTML = data.map(item => {
        const itemId = item._id || item.id; // Correct order for Mongo/MySQL dual logic
        
        let contentHtml = '';
        if (endpoint === 'users') {
            contentHtml = `<i class="fas fa-user-circle"></i> <strong>${item.name}</strong>`;
        } else if (endpoint === 'expenses') {
            contentHtml = `<i class="fas fa-money-bill-wave"></i> ₹${parseFloat(item.amount).toLocaleString('en-IN')} - ${item.title}`;
        } else if (endpoint === 'budgets') {
            contentHtml = `<i class="fas fa-clock"></i> ${item.category}: ₹${parseFloat(item.limit).toLocaleString('en-IN')}`;
        } else if (endpoint === 'categories') {
            contentHtml = `<i class="fas fa-tag"></i> ${item.name} <small>(${item.type})</small>`;
        } else if (endpoint === 'reports') {
            contentHtml = `<i class="fas fa-chart-bar"></i> ₹${parseFloat(item.total).toLocaleString('en-IN')} on ${item.date}`;
        }

        return `
            <div class="data-row">
                <div class="data-content">${contentHtml}</div>
                <div class="data-actions">
                    <button class="btn danger" onclick="deleteData('${endpoint}', '${itemId}', '${container.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).reverse().slice(0, 3).join(''); // Show recent 3
}

// --- CRUD Actions ---

window.deleteData = async function(endpoint, id, resultElementId) {
    if (!confirm('Delete this record?')) return;
    try {
        const response = await fetch(`${API_URL}/${endpoint}/${id}`, { method: 'DELETE' });
        if (response.ok) {
            refreshAllData();
            showToast('Record deleted');
        }
    } catch (err) { alert('Error: ' + err.message); }
};

// --- Form Submissions ---

async function handleFormSubmit(e, endpoint, payloadGen) {
    e.preventDefault();
    const payload = payloadGen();
    
    try {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            e.target.reset();
            showToast('Record Saved Successfully!');
            refreshAllData();
        } else {
            const errText = await response.text();
            alert('Error: ' + errText);
        }
    } catch (err) { alert('Network Error: ' + err.message); }
}

document.getElementById('user-form').addEventListener('submit', (e) => {
    handleFormSubmit(e, 'users', () => ({
        name: document.getElementById('user-name').value,
        email: document.getElementById('user-email').value,
        password: document.getElementById('user-password').value
    }));
});

document.getElementById('expense-form').addEventListener('submit', (e) => {
    handleFormSubmit(e, 'expenses', () => ({
        title: document.getElementById('expense-title').value,
        amount: parseFloat(document.getElementById('expense-amount').value),
        category: document.getElementById('expense-category').value,
        date: document.getElementById('expense-date').value
    }));
});

document.getElementById('category-form').addEventListener('submit', (e) => {
    handleFormSubmit(e, 'categories', () => ({
        name: document.getElementById('category-name').value,
        type: document.getElementById('category-type').value
    }));
});

document.getElementById('budget-form').addEventListener('submit', (e) => {
    handleFormSubmit(e, 'budgets', () => ({
        category: document.getElementById('budget-category').value,
        limit: parseFloat(document.getElementById('budget-limit').value)
    }));
});

document.getElementById('report-form').addEventListener('submit', (e) => {
    handleFormSubmit(e, 'reports', () => ({
        total: parseFloat(document.getElementById('report-total').value),
        date: document.getElementById('report-date').value
    }));
});
