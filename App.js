// src/App.js
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  Timestamp,
  setDoc
} from 'firebase/firestore';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  Plus, Trash2, Edit, X, TrendingUp, Tag, Calendar, DollarSign, Filter, LogOut,
  Moon, Sun, Settings, Search, Download, PiggyBank, BarChart2, Mail, Lock,
  Eye, EyeOff
} from 'lucide-react';
import { subMonths, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'framer-motion'; // <-- NEW IMPORT

// --- Firebase Configuration (unchanged) ---
const firebaseConfig = {
  apiKey: "AIzaSyCmcQOaZBoQpCDmAbGKAnKjZKEbslzPZ2k",
  authDomain: "my-expense-tracker-3ca48.firebaseapp.com",
  projectId: "my-expense-tracker-3ca48",
  storageBucket: "my-expense-tracker-3ca48.appspot.com",
  messagingSenderId: "783722228755",
  appId: "1:783722228755:web:91743272648e7bd95063e6",
  measurementId: "G-S2ZQEYZ1W7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = firebaseConfig.projectId;

// --- Theme helpers ---
const setDocumentTheme = (theme) => {
  document.documentElement.className = theme;
};

// --- Default categories (now editable) ---
const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#FF6384', icon: '🍔' },
  { name: 'Transport', color: '#36A2EB', icon: '🚗' },
  { name: 'Shopping', color: '#FFCE56', icon: '🛍️' },
  { name: 'Utilities', color: '#4BC0C0', icon: '💡' },
  { name: 'Entertainment', color: '#9966FF', icon: '🎬' },
  { name: 'Health', color: '#FF9F40', icon: '❤️' },
  { name: 'Other', color: '#C9CBCF', icon: '❓' },
];

const getCategory = (categoryName, categories = DEFAULT_CATEGORIES) => categories.find(c => c.name === categoryName) || { name: 'Other', color: '#CCCCCC', icon: '❓' };
const formatCurrency = (amount) => `$${Number(amount).toFixed(2)}`;

// --- Small Toast (inline) ---
const Toast = ({ text, onClose }) => {
  if (!text) return null;
  return (
    <div className="fixed right-4 bottom-6 z-50">
      <div className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
        <span>{text}</span>
        <button onClick={onClose} className="text-gray-300 hover:text-white"><X size={16} /></button>
      </div>
    </div>
  );
};

// --- Spinner ---
const Spinner = ({ fullScreen = false }) => (
  <div className={`flex justify-center items-center h-full w-full ${fullScreen ? 'min-h-screen bg-gray-100 dark:bg-gray-900' : ''}`}>
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
  </div>
);

// --- Card (MODIFIED with framer-motion) ---
const Card = ({ children, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className={`bg-white/60 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-lg p-6 ${className}`}
  >
    {children}
  </motion.div>
);

// --- Modal (MODIFIED with framer-motion) ---
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex justify-center items-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg m-4 transform transition-all duration-200"
      >
        <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={24} /></button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </motion.div>
  );
};

// --- Login Page (unchanged) ---
const LoginPage = () => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err.message || 'Google sign in failed');
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message || 'Auth error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-white dark:from-gray-900 dark:to-black flex flex-col justify-center items-center p-4 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <DollarSign className="text-indigo-500 mx-auto mb-3" size={48} />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Finance Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Sign in to manage your finances.</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl p-8">
          <button onClick={handleGoogleSignIn} disabled={isLoading} className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-semibold disabled:opacity-50">
            <svg className="w-6 h-6" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303..." /></svg>
            Continue with Google
          </button>

          <div className="my-6 flex items-center"><div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div><span className="mx-4 text-gray-500">or</span><div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div></div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-10 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button type="submit" disabled={isLoading} className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold transition-colors shadow-md disabled:bg-indigo-400">
              {isLoading ? <Spinner /> : (isLoginView ? 'Sign In' : 'Sign Up')}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
            {isLoginView ? "Don't have an account?" : "Already have an account?"}
            <button onClick={() => { setIsLoginView(!isLoginView); setError('') }} className="font-semibold text-indigo-600 hover:text-indigo-500 ml-1">
              {isLoginView ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

// --- NEW: TransactionForm (replaces ExpenseForm) ---
const TransactionForm = ({ onSave, onCancel, transaction, categories }) => {
  // --- State ---
  const [type, setType] = useState(transaction ? transaction.type : 'expense');
  const [amount, setAmount] = useState(transaction ? transaction.amount : '');
  const [category, setCategory] = useState(transaction ? transaction.category : categories[0]?.name || 'Other');
  const [date, setDate] = useState(transaction ? transaction.date : new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState(transaction ? transaction.description : '');
  const [recurring, setRecurring] = useState(transaction ? !!transaction.recurring : false);
  const [error, setError] = useState('');

  // Update state if the transaction prop changes (for editing)
  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmount(transaction.amount);
      setCategory(transaction.category);
      setDate(transaction.date);
      setDescription(transaction.description);
      setRecurring(!!transaction.recurring);
    } else {
      // Reset form for new entry
      setType('expense');
      setAmount('');
      setCategory(categories[0]?.name || 'Other');
      setDate(new Date().toISOString().split('T')[0]);
      setDescription('');
      setRecurring(false);
    }
  }, [transaction, categories]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0 || !category || !date) {
      setError('Please fill in Amount (positive), Category, and Date.');
      return;
    }
    setError('');
    onSave({
      id: transaction?.id,
      type,
      amount: Math.abs(amt), // Always store as positive
      category: type === 'income' ? 'Income' : category, // Force category for income
      date,
      description,
      recurring,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-100 border-red-400 text-red-700 px-4 py-3 rounded-lg" role="alert">{error}</div>}

      {/* --- Type Toggle --- */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
        <button
          type="button"
          onClick={() => setType('expense')}
          className={`px-4 py-2 rounded-md font-semibold transition-all ${type === 'expense' ? 'bg-white dark:bg-gray-800 shadow' : 'text-gray-600 dark:text-gray-400'}`}
        >
          Expense
        </button>
        <button
          type="button"
          onClick={() => setType('income')}
          className={`px-4 py-2 rounded-md font-semibold transition-all ${type === 'income' ? 'bg-white dark:bg-gray-800 shadow' : 'text-gray-600 dark:text-gray-400'}`}
        >
          Income
        </button>
      </div>

      <input inputMode="decimal" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />

      {/* --- Category (hide for income) --- */}
      {type === 'expense' && (
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
          {categories.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
        </select>
      )}

      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" placeholder="Description (optional)" className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"></textarea>

      <label className="flex items-center gap-3">
        <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded" />
        <span className="text-sm text-gray-600 dark:text-gray-300">Mark as recurring</span>
      </label>

      <div className="flex justify-end gap-3 pt-4">
        <button type="button" onClick={onCancel} className="px-6 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 font-semibold">Cancel</button>
        <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold shadow-md">Save Transaction</button>
      </div>
    </form>
  );
};

// --- NEW: TransactionItem (replaces ExpenseItem) ---
const TransactionItem = ({ transaction, onEdit, onDelete, categories }) => {
  const isIncome = transaction.type === 'income';
  const cat = isIncome ? { name: 'Income', color: '#22C55E', icon: '💰' } : getCategory(transaction.category, categories);

  return (
    <div className="flex items-center justify-between p-4 bg-white/90 dark:bg-gray-800/80 rounded-xl mb-3 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.01]">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: cat.color }}>{cat.icon}</div>
        <div>
          <p className="font-bold text-gray-800 dark:text-gray-100">{transaction.description || cat.name}{transaction.recurring ? <span className="ml-2 inline-block text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full">Recurring</span> : null}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(transaction.date).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <p className={`font-bold text-lg ${isIncome ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
          {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
        </p>
        <div className="flex gap-1">
          <button onClick={() => onEdit(transaction)} className="text-gray-500 hover:text-indigo-600 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><Edit size={18} /></button>
          <button onClick={() => { if (window.confirm('Delete this transaction?')) onDelete(transaction.id); }} className="text-gray-500 hover:text-red-600 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><Trash2 size={18} /></button>
        </div>
      </div>
    </div>
  );
};

// --- MODIFIED: Dashboard ---
const Dashboard = ({ transactions, budget, categories }) => {
  const [dateRange, setDateRange] = useState('month');

  const filteredTransactions = useMemo(() => {
    const now = new Date(); let start, end;
    switch (dateRange) {
      case 'week': start = startOfWeek(now); end = endOfWeek(now); break;
      case 'year': start = startOfYear(now); end = endOfYear(now); break;
      case 'all': return transactions;
      default: start = startOfMonth(now); end = endOfMonth(now);
    }
    return transactions.filter(ex => { const d = new Date(ex.date); return d >= start && d <= end; });
  }, [transactions, dateRange]);

  // --- NEW LOGIC for Income/Expense ---
  const { totalExpenses, totalIncome, netBalance, expensePieData } = useMemo(() => {
    const expenses = filteredTransactions.filter(t => t.type === 'expense');
    const income = filteredTransactions.filter(t => t.type === 'income');

    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const totalIncome = income.reduce((s, e) => s + e.amount, 0);
    const netBalance = totalIncome - totalExpenses;

    const expensePieData = Array.from(
      expenses.reduce((m, { category, amount }) => m.set(category, (m.get(category) || 0) + amount), new Map()),
      ([name, value]) => ({ name, value })
    );

    return { totalExpenses, totalIncome, netBalance, expensePieData };
  }, [filteredTransactions]);

  const budgetPerc = budget > 0 ? (totalExpenses / budget) * 100 : 0;
  
  const barData = useMemo(() => Array.from({ length: 6 }, (_, i) => subMonths(new Date(), i)).reverse().map(m => ({ 
    name: format(m, 'MMM'), 
    Expenses: transactions.filter(e => e.type === 'expense' && new Date(e.date).getMonth() === m.getMonth() && new Date(e.date).getFullYear() === m.getFullYear()).reduce((s, e) => s + e.amount, 0),
    Income: transactions.filter(e => e.type === 'income' && new Date(e.date).getMonth() === m.getMonth() && new Date(e.date).getFullYear() === m.getFullYear()).reduce((s, e) => s + e.amount, 0)
  })), [transactions]);


  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <select onChange={(e) => setDateRange(e.target.value)} value={dateRange} className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg outline-none">
          <option value="month">This Month</option>
          <option value="week">This Week</option>
          <option value="year">This Year</option>
          <option value="all">All Time</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <h3 className="text-lg text-gray-500 dark:text-gray-400">Total Income</h3>
          <p className="text-4xl font-bold text-green-500 dark:text-green-400 mt-2">{formatCurrency(totalIncome)}</p>
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500"><TrendingUp className="text-green-500" /> <span>for the period</span></div>
        </Card>

        <Card>
          <h3 className="text-lg text-gray-500 dark:text-gray-400">Total Spent</h3>
          <p className="text-4xl font-bold text-red-500 dark:text-red-400 mt-2">{formatCurrency(totalExpenses)}</p>
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500"><TrendingUp className="text-red-500" /> <span>for the period</span></div>
        </Card>

        <Card>
          <h3 className="text-lg text-gray-500 dark:text-gray-400">Net Balance</h3>
          <p className={`text-4xl font-bold mt-2 ${netBalance >= 0 ? 'text-gray-800 dark:text-gray-100' : 'text-red-500 dark:text-red-400'}`}>
            {formatCurrency(netBalance)}
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-500"><PiggyBank className="text-indigo-500" /> <span>Your savings</span></div>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg text-gray-500 dark:text-gray-400">Monthly Budget (vs. Expenses)</h3>
        <div className="flex items-center justify-between mt-2">
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{formatCurrency(totalExpenses)} <span className="text-lg text-gray-500">/ {formatCurrency(budget)}</span></p>
          <p className="text-lg font-semibold" style={{ color: budgetPerc > 100 ? '#ef4444' : '#22c55e' }}>{budgetPerc.toFixed(1)}% Spent</p>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mt-3 overflow-hidden">
          <div className="h-4 rounded-full" style={{ width: `${Math.min(budgetPerc, 100)}%`, backgroundColor: budgetPerc > 90 ? '#ef4444' : (budgetPerc > 70 ? '#f59e0b' : '#22c55e') }}></div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 h-96">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><BarChart2 />Spending Trend</h3>
          <ResponsiveContainer width="100%" height="80%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(value, name) => [formatCurrency(value), name]} />
              <Legend />
              <Bar dataKey="Income" fill="#22C55E" />
              <Bar dataKey="Expenses" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="lg:col-span-2 h-96">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2"><PiggyBank />Expense Breakdown</h3>
          {expensePieData.length > 0 ? <ResponsiveContainer width="100%" height="80%"><PieChart><Pie data={expensePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4}>{expensePieData.map((e, i) => <Cell key={`c-${i}`} fill={getCategory(e.name, categories).color} />)}</Pie><Tooltip formatter={(v) => formatCurrency(v)} /><Legend /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-gray-500">No data for this period.</div>}
        </Card>
      </div>
    </div>
  );
};

// --- Settings Modal (unchanged) ---
const SettingsModal = ({ isOpen, onClose, onSave, budget }) => {
  const [newBudget, setNewBudget] = useState(budget);
  useEffect(() => setNewBudget(budget), [budget]);
  return (<Modal isOpen={isOpen} onClose={onClose} title="Settings"><div className="space-y-4"><label htmlFor="budget" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Monthly Budget</label><input type="number" id="budget" value={newBudget} onChange={(e) => setNewBudget(e.target.value)} className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border rounded-lg outline-none" /></div><div className="flex justify-end pt-4"><button onClick={() => { onSave({ budget: parseFloat(newBudget) || 0 }); onClose(); }} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold">Save</button></div></Modal>);
};

// --- Main App (MODIFIED) ---
export default function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // App data/state
  const [transactions, setTransactions] = useState([]); // <-- RENAMED
  const [settings, setSettings] = useState({ theme: localStorage.getItem('theme') || 'light', budget: 1000 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null); // <-- RENAMED
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('app_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });
  const [sortBy, setSortBy] = useState('date-desc');
  const [toast, setToast] = useState('');

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load user-specific Firestore data
  useEffect(() => {
    if (!user) {
      setTransactions([]); // Clear data on logout
      return;
    }
    // settings doc
    const settingsDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/settings/userSettings`);
    const unsubSettings = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(prev => ({ ...prev, ...docSnap.data() }));
        if (docSnap.data().theme) {
          setDocumentTheme(docSnap.data().theme);
          localStorage.setItem('theme', docSnap.data().theme);
        }
      }
    });

    // --- MODIFIED: Listen to 'transactions' collection ---
    const transQuery = query(collection(db, `artifacts/${appId}/users/${user.uid}/transactions`), orderBy('date', 'desc'));
    const unsubTransactions = onSnapshot(transQuery, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    });

    return () => { unsubTransactions(); unsubSettings(); };
  }, [user]);

  // persist categories locally
  useEffect(() => {
    localStorage.setItem('app_categories', JSON.stringify(categories));
  }, [categories]);

  // Save settings to Firestore
  const handleSaveSettings = async (newSettings) => {
    if (!user) return;
    await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}/settings/userSettings`), newSettings, { merge: true });
    setToast('Settings saved');
    setTimeout(() => setToast(''), 2500);
  };

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
    const newSettings = { ...settings, theme: newTheme };
    setSettings(newSettings);
    setDocumentTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    handleSaveSettings(newSettings);
  };

  // --- MODIFIED: Save transaction (create or update) ---
  const handleSaveTransaction = async (data) => {
    if (!user) { setToast('You must be signed in'); return; }
    
    // Create a clean payload, remove ID if it exists
    const payload = {
      type: data.type,
      amount: data.amount,
      category: data.category,
      date: data.date,
      description: data.description,
      recurring: data.recurring,
      createdAt: Timestamp.now()
    };

    const colRef = collection(db, `artifacts/${appId}/users/${user.uid}/transactions`);
    try {
      if (editingTransaction && editingTransaction.id) {
        await updateDoc(doc(colRef, editingTransaction.id), payload); // Use clean payload
        setToast('Transaction updated');
      } else {
        await addDoc(colRef, payload);
        setToast('Transaction added');
      }
    } catch (err) {
      console.error(err);
      setToast('Error saving transaction');
    } finally {
      setIsModalOpen(false); setEditingTransaction(null);
      setTimeout(() => setToast(''), 2500);
    }
  };

  // --- MODIFIED: Delete transaction ---
  const handleDeleteTransaction = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/users/${user.uid}/transactions`, id));
      setToast('Transaction deleted');
      setTimeout(() => setToast(''), 2000);
    } catch (err) {
      console.error(err);
      setToast('Delete failed');
      setTimeout(() => setToast(''), 2000);
    }
  };

  const openEditModal = (trans) => { setEditingTransaction(trans); setIsModalOpen(true); };
  const openNewModal = () => { setEditingTransaction(null); setIsModalOpen(true); };

  // --- MODIFIED: Filtering + sorting ---
  const filteredTransactions = useMemo(() => {
    let list = transactions.slice();
    if (categoryFilter !== 'All') list = list.filter(ex => ex.category === categoryFilter);
    if (searchTerm) list = list.filter(ex => (ex.description || '').toLowerCase().includes(searchTerm.toLowerCase()));
    switch (sortBy) {
      case 'date-asc': list.sort((a, b) => new Date(a.date) - new Date(b.date)); break;
      case 'date-desc': list.sort((a, b) => new Date(b.date) - new Date(a.date)); break;
      case 'amount-asc': list.sort((a, b) => a.amount - b.amount); break;
      case 'amount-desc': list.sort((a, b) => b.amount - b.amount); break;
      default: break;
    }
    return list;
  }, [transactions, categoryFilter, searchTerm, sortBy]);

  // --- MODIFIED: Export CSV ---
  const exportToCSV = () => {
    const headers = "Date,Type,Category,Description,Amount,Recurring\n";
    const rows = filteredTransactions.map(e => `${e.date},${e.type},${e.category},"${(e.description || '').replace(/"/g, '""')}",${e.amount},${e.recurring ? 'yes' : 'no'}`).join("\n");
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
    link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // --- Export PDF (unchanged) ---
  const exportToPDF = async () => {
    const node = document.getElementById('transactions-card');
    if (!node) { setToast('Nothing to export'); return; }
    try {
      const canvas = await html2canvas(node, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`transactions_${new Date().toISOString().split('T')[0]}.pdf`);
      setToast('PDF exported');
      setTimeout(() => setToast(''), 2000);
    } catch (err) {
      console.error(err);
      setToast('PDF export failed');
      setTimeout(() => setToast(''), 2000);
    }
  };

  // --- NEW: Export JSON ---
  const exportToJSON = () => {
    if (filteredTransactions.length === 0) {
      setToast('No data to export');
      setTimeout(() => setToast(''), 2000);
      return;
    }
    const dataStr = JSON.stringify({
      transactions: filteredTransactions,
      settings: settings,
      categories: categories
    }, null, 2); // 'null, 2' formats it nicely
    
    const link = document.createElement("a");
    link.href = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    link.download = `finance_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    setToast('JSON backup exported');
    setTimeout(() => setToast(''), 2000);
  };

  // Category management (unchanged logic)
  const addCategory = (cat) => {
    if (!cat || categories.some(c => c.name.toLowerCase() === cat.name.toLowerCase())) { setToast('Category exists or invalid'); setTimeout(() => setToast(''), 1500); return; }
    const newCats = [...categories, cat];
    setCategories(newCats);
    setToast('Category added');
    setTimeout(() => setToast(''), 1500);
  };
  const removeCategory = (name) => {
    if (name === 'Income') { setToast('Cannot remove default Income category'); setTimeout(() => setToast(''), 1500); return; }
    if (!window.confirm(`Delete category "${name}"? Existing transactions keep their category value.`)) return;
    setCategories(categories.filter(c => c.name !== name));
    setToast('Category removed');
    setTimeout(() => setToast(''), 1500);
  };

  if (isLoading) return <Spinner fullScreen={true} />;

  return user ? (
    <div className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 min-h-screen font-sans">
      <header className="dark:bg-black/10 bg-white/30 backdrop-blur-lg shadow-md p-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3"><DollarSign className="text-indigo-500" size={32} /><h1 className="text-2xl font-bold text-gray-900 dark:text-white hidden sm:block">Dashboard</h1></div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-sm text-gray-600 dark:text-gray-300 hidden md:block">Welcome, {user.displayName || user.email}</span>
          <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">{settings.theme === 'light' ? <Moon /> : <Sun />}</button>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><Settings /></button>
          <button onClick={() => setIsCategoriesOpen(true)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><Tag /></button>
          <button onClick={() => signOut(auth)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><LogOut /></button>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8">
        <Dashboard transactions={transactions} budget={settings.budget} categories={categories} />

        <div className="mt-8" id="transactions-card">
          <Card>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Transactions</h2>

              <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                <div className="relative flex-grow md:flex-grow-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg outline-none" />
                </div>

                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="py-2 px-3 bg-gray-50 dark:bg-gray-700 border rounded-lg outline-none">
                  <option value="All">All Categories</option>
                  {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>

                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="py-2 px-3 bg-gray-50 dark:bg-gray-700 border rounded-lg outline-none">
                  <option value="date-desc">Newest</option>
                  <option value="date-asc">Oldest</option>
                  <option value="amount-desc">Amount (High → Low)</option>
                  <option value="amount-asc">Amount (Low → High)</option>

                </select>

                <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"><Download size={18} /> <span className="hidden sm:inline">CSV</span></button>
                <button onClick={exportToPDF} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"><Download size={18} /> <span className="hidden sm:inline">PDF</span></button>
                <button onClick={exportToJSON} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"><Download size={18} /> <span className="hidden sm:inline">JSON</span></button>
                <button onClick={openNewModal} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold shadow-md"><Plus size={20} /> <span className="hidden sm:inline">Add</span></button>
              </div>
            </div>

            <div>
              {/* --- MODIFIED: Animated list --- */}
              <AnimatePresence>
                {filteredTransactions.length > 0 ? filteredTransactions.map(t => (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ duration: 0.3 }}
                  >
                    <TransactionItem
                      transaction={t}
                      onEdit={openEditModal}
                      onDelete={handleDeleteTransaction}
                      categories={categories}
                    />
                  </motion.div>
                )) : <div className="text-center py-10 text-gray-500"><p className="font-semibold">No transactions found.</p></div>}
              </AnimatePresence>
            </div>
          </Card>
        </div>
      </main>

      {/* --- MODIFIED: Modal for transactions --- */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }} title={editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}>
        <TransactionForm
          onSave={handleSaveTransaction}
          onCancel={() => { setIsModalOpen(false); setEditingTransaction(null); }}
          transaction={editingTransaction}
          categories={categories}
        />
      </Modal>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onSave={(s) => handleSaveSettings({ ...settings, ...s })} budget={settings.budget} />

      <Modal isOpen={isCategoriesOpen} onClose={() => setIsCategoriesOpen(false)} title="Manage Categories">
        <CategoryManager categories={categories} addCategory={addCategory} removeCategory={removeCategory} />
      </Modal>

      <Toast text={toast} onClose={() => setToast('')} />
    </div>
  ) : <LoginPage />;
}

// --- Category Manager Component (unchanged) ---
const CategoryManager = ({ categories, addCategory, removeCategory }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  const [color, setColor] = useState('#A3A3A3');

  const handleAdd = () => {
    if (!name) return;
    addCategory({ name, icon, color });
    setName(''); setIcon('🏷️'); setColor('#A3A3A3');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border rounded-lg outline-none" />
        <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Icon (emoji)" className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border rounded-lg outline-none" />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Pick color" className="w-full h-10 rounded-lg border" />
      </div>
      <div className="flex gap-3">
        <button onClick={handleAdd} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Add Category</button>
      </div>

      <div className="pt-4">
        <h4 className="text-sm font-semibold mb-2">Existing</h4>
        <div className="space-y-2">
          {categories.map(c => (
            <div key={c.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: c.color }}>{c.icon}</div><div><div className="font-semibold">{c.name}</div><div className="text-xs text-gray-500">{c.color}</div></div></div>
              <div className="flex gap-2">
                <button disabled={c.name === 'Income'} onClick={() => removeCategory(c.name)} className="px-3 py-1 bg-red-100 text-red-700 rounded-md disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-500">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};