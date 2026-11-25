
const STORAGE_KEY = "expenseflow_transactions";
const THEME_KEY = "expenseflow_theme";

let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let editingId = null;

const $ = id => document.getElementById(id);

const form = $("transactionForm");
const titleInput = $("title");
const amountInput = $("amount");
const typeInput = $("type");
const categoryInput = $("category");
const dateInput = $("date");
const transactionList = $("transactionList");

const money = amount =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR"
  }).format(amount);

function today() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000)
    .toISOString().slice(0, 10);
}

dateInput.value = today();
$("todayDate").textContent = new Date().toLocaleDateString(
  "en-IN",
  { day: "numeric", month: "long", year: "numeric" }
);

$("reportMonth").value = today().slice(0, 7);

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function totals(items) {
  const income = items
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expenses = items
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return {
    income,
    expenses,
    balance: income - expenses
  };
}

function renderDashboard() {
  const result = totals(transactions);

  $("balance").textContent = money(result.balance);
  $("income").textContent = money(result.income);
  $("expenses").textContent = money(result.expenses);
}

function renderTransactions() {
  const search = $("search").value.toLowerCase().trim();
  const filter = $("filterType").value;

  const filtered = transactions
    .filter(t => {
      const matchesSearch =
        t.title.toLowerCase().includes(search) ||
        t.category.toLowerCase().includes(search);

      const matchesType =
        filter === "all" || t.type === filter;

      return matchesSearch && matchesType;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!filtered.length) {
    transactionList.innerHTML = `
      <div class="empty-state">
        <span>📊</span>
        <p>No transactions found</p>
        <small>Try another search or add a transaction.</small>
      </div>`;
    return;
  }

  transactionList.innerHTML = filtered.map(t => `
    <div class="transaction-item">
      <div>
        <strong>${escapeHTML(t.title)}</strong>
        <small>${escapeHTML(t.category)} · ${escapeHTML(t.date)}</small>
      </div>
      <div>
        <strong class="${t.type === "income" ? "positive" : "negative"}">
          ${t.type === "income" ? "+" : "-"}${money(Number(t.amount))}
        </strong>
        <div class="transaction-actions">
          <button onclick="editTransaction('${t.id}')">Edit</button>
          <button onclick="deleteTransaction('${t.id}')">Delete</button>
        </div>
      </div>
    </div>
  `).join("");
}

function renderMonthlyReport() {
  const month = $("reportMonth").value;

  const monthly = transactions.filter(t =>
    t.date.startsWith(month)
  );

  const result = totals(monthly);

  $("monthlyIncome").textContent = money(result.income);
  $("monthlyExpenses").textContent = money(result.expenses);
  $("monthlySavings").textContent = money(result.balance);

  renderExpenseChart(monthly);
  renderCategoryAnalysis(monthly);
}

function renderExpenseChart(items) {
  const container = $("expenseChart");

  const daily = {};

  items
    .filter(t => t.type === "expense")
    .forEach(t => {
      const day = Number(t.date.slice(8, 10));
      daily[day] = (daily[day] || 0) + Number(t.amount);
    });

  const entries = Object.entries(daily)
    .sort((a, b) => Number(a[0]) - Number(b[0]));

  if (!entries.length) {
    container.innerHTML =
      '<p class="muted">No expense data for this month.</p>';
    return;
  }

  const max = Math.max(...entries.map(([, amount]) => amount));

  container.innerHTML = entries.map(([day, amount]) => `
    <div class="chart-row">
      <div class="chart-info">
        <span>Day ${day}</span>
        <strong>${money(amount)}</strong>
      </div>
      <div class="chart-track">
        <div class="chart-fill"
          style="width:${(amount / max) * 100}%"></div>
      </div>
    </div>
  `).join("");
}

function renderCategoryAnalysis(items) {
  const container = $("categoryAnalysis");
  const categories = {};

  items
    .filter(t => t.type === "expense")
    .forEach(t => {
      categories[t.category] =
        (categories[t.category] || 0) + Number(t.amount);
    });

  const entries = Object.entries(categories)
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    container.innerHTML =
      '<p class="muted">No category data available.</p>';
    return;
  }

  const total = entries.reduce((sum, item) => sum + item[1], 0);

  container.innerHTML = entries.map(([name, amount]) => `
    <div class="category-item">
      <span class="category-name">${escapeHTML(name)}</span>
      <strong>${money(amount)}</strong>
      <small>${((amount / total) * 100).toFixed(1)}%</small>
    </div>
  `).join("");
}

function render() {
  renderDashboard();
  renderTransactions();
  renderMonthlyReport();
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const amount = Number(amountInput.value);
  const date = dateInput.value;

  if (!title || !Number.isFinite(amount) || amount <= 0 || !date) {
    alert("Please enter valid transaction details.");
    return;
  }

  if (editingId) {
    transactions = transactions.map(t =>
      t.id === editingId
        ? {
            ...t,
            title,
            amount,
            type: typeInput.value,
            category: categoryInput.value,
            date
          }
        : t
    );
  } else {
    transactions.push({
      id: crypto.randomUUID(),
      title,
      amount,
      type: typeInput.value,
      category: categoryInput.value,
      date
    });
  }

  save();
  resetForm();
  render();
});

function editTransaction(id) {
  const t = transactions.find(item => item.id === id);
  if (!t) return;

  editingId = id;
  titleInput.value = t.title;
  amountInput.value = t.amount;
  typeInput.value = t.type;
  categoryInput.value = t.category;
  dateInput.value = t.date;

  $("submitBtn").textContent = "Save Changes";
  $("cancelEdit").classList.remove("hidden");

  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  editingId = null;
  form.reset();
  dateInput.value = today();
  $("submitBtn").textContent = "+ Add Transaction";
  $("cancelEdit").classList.add("hidden");
}

function deleteTransaction(id) {
  if (!confirm("Delete this transaction?")) return;

  transactions = transactions.filter(t => t.id !== id);

  if (editingId === id) resetForm();

  save();
  render();
}

$("cancelEdit").addEventListener("click", resetForm);

$("search").addEventListener("input", renderTransactions);
$("filterType").addEventListener("change", renderTransactions);
$("reportMonth").addEventListener("change", renderMonthlyReport);

$("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("light");

  localStorage.setItem(
    THEME_KEY,
    document.body.classList.contains("light") ? "light" : "dark"
  );
});

if (localStorage.getItem(THEME_KEY) === "light") {
  document.body.classList.add("light");
}

$("exportBtn").addEventListener("click", () => {
  if (!transactions.length) {
    alert("No transactions to export.");
    return;
  }

  const rows = [
    ["Name", "Amount", "Type", "Category", "Date"],
    ...transactions.map(t => [
      t.title, t.amount, t.type, t.category, t.date
    ])
  ];

  const csv = rows.map(row =>
    row.map(value =>
      `"${String(value).replace(/"/g, '""')}"`
    ).join(",")
  ).join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "ExpenseFlow-Transactions.csv";
  link.click();

  URL.revokeObjectURL(url);
});

$("clearAll").addEventListener("click", () => {
  if (!confirm("Are you sure? This will delete all transactions.")) return;

  transactions = [];
  save();
  resetForm();
  render();
});

render();
// Register Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then(() => console.log("Expense Tracker is ready!"))
      .catch(error => console.error("Service Worker error:", error));
  });
}