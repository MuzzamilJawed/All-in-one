"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  paymentMethod: "cash" | "card" | "transfer" | "other";
  notes?: string;
}

const CATEGORIES = ["Food", "Transport", "Entertainment", "Utilities", "Healthcare", "Shopping", "Education", "Other"];
const COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2"];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "Food",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "cash" as const,
    notes: "",
  });
  const [filter, setFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("month"); // day, week, month, year
  const [editingId, setEditingId] = useState<string | null>(null);

  // Load expenses from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("expenses");
    if (saved) {
      setExpenses(JSON.parse(saved));
    }
  }, []);

  // Save expenses to localStorage
  useEffect(() => {
    localStorage.setItem("expenses", JSON.stringify(expenses));
  }, [expenses]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || !formData.amount) {
      alert("Please fill in all required fields");
      return;
    }

    if (editingId) {
      setExpenses(
        expenses.map((exp) =>
          exp.id === editingId
            ? { ...exp, ...formData, amount: parseFloat(formData.amount) }
            : exp
        )
      );
      setEditingId(null);
    } else {
      const newExpense: Expense = {
        id: Date.now().toString(),
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category,
        date: formData.date,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
      };
      setExpenses([newExpense, ...expenses]);
    }

    setFormData({
      description: "",
      amount: "",
      category: "Food",
      date: new Date().toISOString().split("T")[0],
      paymentMethod: "cash",
      notes: "",
    });
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingId(expense.id);
    setFormData({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
      date: expense.date,
      paymentMethod: expense.paymentMethod,
      notes: expense.notes || "",
    });
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter((exp) => exp.id !== id));
  };

  const getDateRange = () => {
    const now = new Date();
    const start = new Date();

    switch (timeRange) {
      case "day":
        start.setDate(now.getDate() - 1);
        break;
      case "week":
        start.setDate(now.getDate() - 7);
        break;
      case "month":
        start.setMonth(now.getMonth() - 1);
        break;
      case "year":
        start.setFullYear(now.getFullYear() - 1);
        break;
    }

    return start;
  };

  const filteredExpenses = expenses.filter((exp) => {
    const expDate = new Date(exp.date);
    const startDate = getDateRange();
    const isInRange = expDate >= startDate;
    const isInCategory = filter === "all" || exp.category === filter;
    return isInRange && isInCategory;
  });

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const avgExpense = filteredExpenses.length > 0 ? totalExpenses / filteredExpenses.length : 0;

  // Prepare data for charts
  const categoryData = CATEGORIES.map((cat) => ({
    name: cat,
    value: filteredExpenses
      .filter((exp) => exp.category === cat)
      .reduce((sum, exp) => sum + exp.amount, 0),
  })).filter((item) => item.value > 0);

  const dailyData: Record<string, number> = {};
  filteredExpenses.forEach((exp) => {
    const date = exp.date;
    dailyData[date] = (dailyData[date] || 0) + exp.amount;
  });

  const lineChartData = Object.entries(dailyData)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, amount]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      amount,
    }));

  const paymentMethodData = ["cash", "card", "transfer", "other"].map((method) => ({
    name: method.charAt(0).toUpperCase() + method.slice(1),
    value: filteredExpenses
      .filter((exp) => exp.paymentMethod === method)
      .reduce((sum, exp) => sum + exp.amount, 0),
  })).filter((item) => item.value > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">💰 Expense Tracker</h1>
          <p className="text-slate-400">Manage and analyze your spending habits</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Add Expense Form */}
          <div className="lg:col-span-1 bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span>➕</span> {editingId ? "Edit" : "Add"} Expense
            </h2>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Lunch at café"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Amount (PKR)</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      paymentMethod: e.target.value as "cash" | "card" | "transfer" | "other",
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="transfer">Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any notes..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  rows={2}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition"
              >
                {editingId ? "Update" : "Add"} Expense
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setFormData({
                      description: "",
                      amount: "",
                      category: "Food",
                      date: new Date().toISOString().split("T")[0],
                      paymentMethod: "cash",
                      notes: "",
                    });
                  }}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded transition"
                >
                  Cancel
                </button>
              )}
            </form>
          </div>

          {/* Stats */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 border border-blue-500">
              <p className="text-slate-200 text-sm font-medium mb-1">Total Expenses</p>
              <p className="text-3xl font-bold">PKR {totalExpenses.toFixed(0)}</p>
              <p className="text-blue-200 text-xs mt-2">{filteredExpenses.length} transactions</p>
            </div>

            <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-lg shadow-lg p-6 border border-green-500">
              <p className="text-slate-200 text-sm font-medium mb-1">Average Expense</p>
              <p className="text-3xl font-bold">PKR {avgExpense.toFixed(0)}</p>
              <p className="text-green-200 text-xs mt-2">Per transaction</p>
            </div>

            <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg shadow-lg p-6 border border-purple-500">
              <p className="text-slate-200 text-sm font-medium mb-1">Time Period</p>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm focus:outline-none focus:border-purple-400 mt-2"
              >
                <option value="day">Last Day</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="year">Last Year</option>
              </select>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Category Breakdown */}
          {categoryData.length > 0 && (
            <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
              <h2 className="text-xl font-bold mb-4">📊 By Category</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: PKR ${value.toFixed(0)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `PKR ${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Daily Trend */}
          {lineChartData.length > 0 && (
            <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
              <h2 className="text-xl font-bold mb-4">📈 Daily Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }}
                    formatter={(value) => `PKR ${value.toFixed(2)}`}
                  />
                  <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Payment Method */}
          {paymentMethodData.length > 0 && (
            <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
              <h2 className="text-xl font-bold mb-4">💳 By Payment Method</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={paymentMethodData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }}
                    formatter={(value) => `PKR ${value.toFixed(2)}`}
                  />
                  <Bar dataKey="value" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category Filter & Stats */}
          <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
            <h2 className="text-xl font-bold mb-4">🏷️ Filter by Category</h2>
            <div className="space-y-2">
              <button
                onClick={() => setFilter("all")}
                className={`w-full px-4 py-2 rounded text-left transition ${
                  filter === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                All Categories ({expenses.length})
              </button>
              {CATEGORIES.map((cat) => {
                const count = expenses.filter((exp) => exp.category === cat).length;
                const amount = expenses
                  .filter((exp) => exp.category === cat)
                  .reduce((sum, exp) => sum + exp.amount, 0);
                return (
                  <button
                    key={cat}
                    onClick={() => setFilter(cat)}
                    className={`w-full px-4 py-2 rounded text-left transition flex justify-between items-center ${
                      filter === cat
                        ? "bg-blue-600 text-white"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="text-xs">{count} • PKR {amount.toFixed(0)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Expenses List */}
        <div className="bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-700">
          <h2 className="text-xl font-bold mb-4">📋 Recent Expenses</h2>
          {filteredExpenses.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No expenses found for this period</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Description</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Category</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Method</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((exp) => (
                    <tr key={exp.id} className="border-b border-slate-700 hover:bg-slate-700/50 transition">
                      <td className="py-3 px-4">{exp.description}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded bg-slate-700 text-xs">{exp.category}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold">PKR {exp.amount.toFixed(2)}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(exp.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs capitalize">{exp.paymentMethod}</span>
                      </td>
                      <td className="py-3 px-4 flex gap-2">
                        <button
                          onClick={() => handleEditExpense(exp)}
                          className="text-blue-400 hover:text-blue-300 transition text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-red-400 hover:text-red-300 transition text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
