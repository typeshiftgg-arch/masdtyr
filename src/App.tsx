/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Receipt, 
  PieChart, 
  History, 
  Settings, 
  Camera, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft,
  Loader2,
  Mail,
  CheckCircle2,
  X,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { useDropzone } from 'react-dropzone';
import { scanReceipt } from './lib/gemini';
import { cn } from './lib/utils';

interface Expense {
  id: number;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
}

const CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Utilities',
  'Health',
  'Travel',
  'Other'
];

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#71717a'];

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'scan' | 'settings'>('dashboard');
  const [isAdding, setIsAdding] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const fetchExpenses = async () => {
    try {
      const res = await fetch('/api/expenses');
      const data = await res.json();
      setExpenses(data);
    } catch (error) {
      console.error('Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expense),
      });
      if (res.ok) {
        fetchExpenses();
        setIsAdding(false);
        setScanResult(null);
      }
    } catch (error) {
      console.error('Failed to add expense');
    }
  };

  const deleteExpense = async (id: number) => {
    try {
      await fetch('/api/expenses/' + id, { method: 'DELETE' });
      fetchExpenses();
    } catch (error) {
      console.error('Failed to delete expense');
    }
  };

  const sendReport = async () => {
    setEmailStatus('sending');
    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        setEmailStatus('success');
        setTimeout(() => setEmailStatus('idle'), 3000);
      } else {
        setEmailStatus('error');
      }
    } catch (error) {
      setEmailStatus('error');
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;
        const result = await scanReceipt(base64);
        setScanResult(result);
        setIsScanning(false);
      };
    } catch (error) {
      console.error('Scanning failed', error);
      setIsScanning(false);
    }
  }, []);

  const dropzoneOptions: any = {
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'] },
    multiple: false
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions);

  // Data processing for charts
  const currentMonthExpenses = expenses.filter(exp => {
    const date = parseISO(exp.date);
    return isWithinInterval(date, {
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date())
    });
  });

  const totalMonthly = currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const categoryData = CATEGORIES.map(cat => ({
    name: cat,
    value: currentMonthExpenses.filter(exp => exp.category === cat).reduce((sum, exp) => sum + exp.amount, 0)
  })).filter(d => d.value > 0);

  const dailyData = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    const amount = currentMonthExpenses
      .filter(exp => new Date(exp.date).getDate() === day)
      .reduce((sum, exp) => sum + exp.amount, 0);
    return { day, amount };
  });

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">SmartSpend</h1>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">AI Expense Tracker</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-zinc-900 text-white p-2.5 rounded-full shadow-lg hover:scale-105 transition-transform active:scale-95"
        >
          <Plus size={20} />
        </button>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Summary Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900 text-white p-6 rounded-3xl shadow-xl col-span-1 md:col-span-2 relative overflow-hidden">
                  <div className="relative z-10">
                    <p className="text-zinc-400 text-sm font-medium">Monthly Spending</p>
                    <h2 className="text-4xl font-bold mt-1">${totalMonthly.toFixed(2)}</h2>
                    <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm font-medium">
                      <ArrowDownLeft size={16} />
                      <span>12% less than last month</span>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl -mr-16 -mt-16" />
                </div>
                
                <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-zinc-100 rounded-xl">
                      <Mail size={20} className="text-zinc-600" />
                    </div>
                    <button 
                      onClick={sendReport}
                      disabled={emailStatus === 'sending'}
                      className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
                    >
                      {emailStatus === 'sending' ? 'Sending...' : 'Send Now'}
                    </button>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Email Report</p>
                    <h3 className="text-sm font-semibold mt-1">
                      {emailStatus === 'success' ? 'Report Sent!' : 'Next: April 1st'}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                  <h3 className="text-sm font-bold text-zinc-900 mb-6 flex items-center gap-2">
                    <PieChart size={18} className="text-zinc-400" />
                    By Category
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={categoryData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {categoryData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-[10px] uppercase font-bold text-zinc-500">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="truncate">{d.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                  <h3 className="text-sm font-bold text-zinc-900 mb-6 flex items-center gap-2">
                    <History size={18} className="text-zinc-400" />
                    Daily Trend
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyData}>
                        <defs>
                          <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#18181b" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#18181b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Area type="monotone" dataKey="amount" stroke="#18181b" strokeWidth={2} fillOpacity={1} fill="url(#colorAmt)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Recent Expenses */}
              <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-zinc-900">Recent Transactions</h3>
                  <button 
                    onClick={() => setActiveTab('history')}
                    className="text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors flex items-center gap-1"
                  >
                    View All <ChevronRight size={14} />
                  </button>
                </div>
                <div className="divide-y divide-zinc-50">
                  {expenses.slice(0, 5).map((exp) => (
                    <div key={exp.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-600">
                          <Receipt size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{exp.title}</p>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{exp.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-zinc-900">-${exp.amount.toFixed(2)}</p>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{format(parseISO(exp.date), 'MMM d')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-bold text-zinc-900">Transaction History</h2>
              <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-zinc-50">
                  {expenses.map((exp) => (
                    <div key={exp.id} className="p-4 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-600">
                          <Receipt size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{exp.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{exp.category}</span>
                            <span className="w-1 h-1 rounded-full bg-zinc-300" />
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{format(parseISO(exp.date), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-sm font-bold text-zinc-900">-${exp.amount.toFixed(2)}</p>
                        <button 
                          onClick={() => deleteExpense(exp.id)}
                          className="p-2 text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'scan' && (
            <motion.div
              key="scan"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-zinc-900">AI Bill Scanner</h2>
                <p className="text-zinc-500 text-sm">Upload a photo of your receipt and let AI do the work.</p>
              </div>

              {!scanResult ? (
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer",
                    isDragActive ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-400",
                    isScanning && "pointer-events-none opacity-50"
                  )}
                >
                  <input {...getInputProps()} />
                  {isScanning ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="animate-spin text-zinc-900" size={48} />
                      <p className="text-sm font-bold text-zinc-900">Analyzing with AI...</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400 mb-4">
                        <Camera size={32} />
                      </div>
                      <p className="text-sm font-bold text-zinc-900">Drop receipt here or click to upload</p>
                      <p className="text-xs text-zinc-400 mt-1 font-medium">Supports JPG, PNG</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900">{scanResult.merchantName || 'Detected Receipt'}</h3>
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{scanResult.mainCategory}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-zinc-900">${scanResult.totalAmount.toFixed(2)}</p>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{scanResult.date || format(new Date(), 'yyyy-MM-dd')}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Detected Items</p>
                    {scanResult.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl">
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{item.title}</p>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{item.category}</p>
                        </div>
                        <p className="text-sm font-bold text-zinc-900">${item.amount.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setScanResult(null)}
                      className="flex-1 py-3 rounded-2xl border border-zinc-200 text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => {
                        scanResult.items.forEach((item: any) => {
                          addExpense({
                            title: item.title,
                            amount: item.amount,
                            category: item.category,
                            date: scanResult.date || format(new Date(), 'yyyy-MM-dd'),
                            notes: `Scanned from ${scanResult.merchantName}`
                          });
                        });
                        setScanResult(null);
                        setActiveTab('dashboard');
                      }}
                      className="flex-1 py-3 rounded-2xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 transition-colors"
                    >
                      Confirm All
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold text-zinc-900">Settings</h2>
              
              <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <Mail size={18} className="text-zinc-400" />
                    Report Configuration
                  </h3>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Receiver Email</label>
                    <input 
                      type="email" 
                      placeholder="your@email.com"
                      className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl">
                    <div>
                      <p className="text-sm font-bold text-zinc-900">Automated Monthly Reports</p>
                      <p className="text-xs text-zinc-500">Send summary on the 1st of every month</p>
                    </div>
                    <div className="w-12 h-6 bg-zinc-900 rounded-full relative">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-zinc-100">
                  <button className="w-full py-3 rounded-2xl bg-zinc-100 text-zinc-900 text-sm font-bold hover:bg-zinc-200 transition-colors">
                    Export Data (CSV)
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-lg px-6 py-3 rounded-full flex items-center gap-8 shadow-2xl z-40">
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<PieChart size={20} />} label="Home" />
        <NavButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={20} />} label="History" />
        <div className="w-px h-6 bg-zinc-700" />
        <NavButton active={activeTab === 'scan'} onClick={() => setActiveTab('scan')} icon={<Camera size={20} />} label="Scan" />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="Settings" />
      </nav>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-zinc-900">Add Expense</h2>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                addExpense({
                  title: formData.get('title') as string,
                  amount: parseFloat(formData.get('amount') as string),
                  category: formData.get('category') as string,
                  date: formData.get('date') as string,
                  notes: formData.get('notes') as string,
                });
              }} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Title</label>
                  <input name="title" required placeholder="e.g. Grocery Shopping" className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Amount</label>
                    <input name="amount" type="number" step="0.01" required placeholder="0.00" className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Date</label>
                    <input name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Category</label>
                  <select name="category" required className="w-full p-4 bg-zinc-50 rounded-2xl border border-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all appearance-none">
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg active:scale-95 mt-4">
                  Save Expense
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all",
        active ? "text-white scale-110" : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      {icon}
      <span className="text-[8px] font-bold uppercase tracking-widest">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-white rounded-full mt-0.5" />}
    </button>
  );
}
