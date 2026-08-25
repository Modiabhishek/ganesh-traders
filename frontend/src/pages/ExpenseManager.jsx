import React, { useState, useEffect } from 'react';
import { transactionAPI } from '../services/api';
import { PlusCircle, Trash2, ArrowLeft, Loader, Printer, Landmark, DollarSign, Calendar } from 'lucide-react';

const parseNaiveDate = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  try {
    const isRender = import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.includes('onrender.com');
    let workingStr = dateStr;
    if (isRender && !dateStr.includes('Z') && !dateStr.includes('+')) {
      workingStr = dateStr + 'Z';
    }

    // If it has a timezone offset, let the browser parse it natively to handle local timezone conversion.
    if (workingStr.includes('Z') || workingStr.includes('+') || (workingStr.includes('-') && workingStr.split('-').length > 3)) {
      return new Date(workingStr);
    }
    // Otherwise, parse it as a local naive date.
    const parts = workingStr.replace('T', ' ').split(' ');
    const dateParts = parts[0].split('-');
    const timeParts = parts[1] ? parts[1].split(':') : ['00', '00'];
    return new Date(
      parseInt(dateParts[0], 10),
      parseInt(dateParts[1], 10) - 1,
      parseInt(dateParts[2], 10),
      parseInt(timeParts[0], 10),
      parseInt(timeParts[1], 10)
    );
  } catch (e) {
    return new Date(dateStr);
  }
};

const ExpenseManager = ({ setCurrentPage, goBack }) => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form inputs state
  const [expenseForm, setExpenseForm] = useState({
    category: 'Electricity (बिजली बिल)',
    amount: '',
    payment_method: 'Cash',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [message, setMessage] = useState({ text: '', type: '' });

  // Edit Expense states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editCategory, setEditCategory] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editMethod, setEditMethod] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDate, setEditDate] = useState('');

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await transactionAPI.getExpenses();
      setExpenses(data);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to load expense records.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    const amountVal = parseFloat(expenseForm.amount) || 0;
    if (amountVal <= 0) {
      setMessage({ text: 'Please enter a valid amount greater than zero.', type: 'danger' });
      return;
    }

    try {
      await transactionAPI.createExpense({
        date: expenseForm.date ? new Date(expenseForm.date).toISOString() : null,
        category: expenseForm.category,
        amount: amountVal,
        payment_method: expenseForm.payment_method,
        description: expenseForm.description || null
      });

      setMessage({ text: 'Expense logged successfully!', type: 'success' });
      setExpenseForm({
        category: 'Electricity (बिजली बिल)',
        amount: '',
        payment_method: 'Cash',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      setShowAddForm(false);
      loadExpenses();
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to record expense.', type: 'danger' });
    }
  };

  const handleDeleteExpense = async (exp) => {
    if (!window.confirm(`Are you sure you want to delete expense record of ₹${exp.amount} for ${exp.category}?`)) {
      return;
    }
    setMessage({ text: '', type: '' });
    try {
      await transactionAPI.deleteExpense(exp.id);
      setMessage({ text: 'Expense record deleted successfully.', type: 'success' });
      loadExpenses();
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to delete expense record.', type: 'danger' });
    }
  };

  const handleUpdateExpense = async (e) => {
    e.preventDefault();
    if (!editingExpense) return;
    const amountVal = parseFloat(editAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert("Please enter a valid amount greater than zero.");
      return;
    }

    try {
      await transactionAPI.updateExpense(editingExpense.id, {
        category: editCategory,
        amount: amountVal,
        payment_method: editMethod,
        description: editDesc || null,
        date: editDate ? `${editDate}T12:00:00` : null
      });
      setMessage({ text: 'Expense record updated successfully.', type: 'success' });
      setShowEditModal(false);
      setEditingExpense(null);
      loadExpenses();
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to update expense record.', type: 'danger' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Calculate total expense sum
  const calculateTotalExpenses = () => {
    return expenses.reduce((acc, exp) => acc + parseFloat(exp.amount), 0);
  };
  const totalExpensesSum = calculateTotalExpenses();

  return (
    <div className="layout-container" style={{ animation: 'fadeIn 0.25s ease' }}>
      
      {/* Page Header */}
      <header className="flex-between no-print" style={{ marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={goBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Expense Tracker — Ganesh Traders</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handlePrint}>
            <Printer size={16} /> Print Sheet
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            <PlusCircle size={16} /> Add Expense
          </button>
        </div>
      </header>

      {/* Print-Only Header */}
      <div className="print-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>BUSINESS EXPENSES STATEMENT</h1>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>Ganesh Traders — Shop Running Costs Log</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Date: {new Date().toLocaleDateString('en-IN')}</p>
        </div>
      </div>

      {message.text && (
        <div className={`badge badge-${message.type} no-print`} style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'block', textTransform: 'none' }}>
          {message.text}
        </div>
      )}

      {/* Summary Card */}
      <section className="glass-panel hover-card metrics-card-rose" style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.5rem', maxWidth: '360px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Total Expense Ledger</span>
          <Landmark size={18} style={{ color: 'var(--danger)' }} />
        </div>
        <h2 style={{ fontSize: '2rem', fontWeight: 700 }}>₹{totalExpensesSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Aggregate shop expenses logged</p>
      </section>

      {/* Inline Expense Entry Form */}
      {showAddForm && (
        <form className="glass-panel no-print" onSubmit={handleExpenseSubmit} style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', padding: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Expense Category *</label>
            <select className="input-field" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}>
              <option value="Electricity (बिजली बिल)">Electricity (बिजली बिल)</option>
              <option value="Rent (दुकान किराया)">Rent (दुकान किराया)</option>
              <option value="Salary (कर्मचारी वेतन)">Salary (कर्मचारी वेतन)</option>
              <option value="Transport (भाड़ा / ट्रांसपोर्ट)">Transport (भाड़ा / ट्रांसपोर्ट)</option>
              <option value="Packaging (पैकिंग सामग्री)">Packaging (पैकिंग सामग्री)</option>
              <option value="Other Shop Expenses (अन्य खर्च)">Other Shop Expenses (अन्य खर्च)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Amount (₹) *</label>
            <input 
              type="number" 
              step="0.01" 
              className="input-field" 
              placeholder="₹ 0.00"
              required 
              value={expenseForm.amount} 
              onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Payment Mode</label>
            <select className="input-field" value={expenseForm.payment_method} onChange={e => setExpenseForm({...expenseForm, payment_method: e.target.value})}>
              <option value="Cash">Cash (नकद)</option>
              <option value="UPI">UPI (PhonePe/GPay)</option>
              <option value="Bank">Bank Transfer</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Date</label>
            <input 
              type="date" 
              className="input-field" 
              value={expenseForm.date} 
              onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} 
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Description / Remarks (विवरण)</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. July month rent paid to building owner"
              value={expenseForm.description} 
              onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} 
            />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ background: 'var(--danger)', color: 'white' }}>Log Expense</button>
          </div>
        </form>
      )}

      {/* Expenses History logs */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader className="spin" size={24} style={{ marginRight: '0.5rem' }} /> Loading expenses ledger...
        </div>
      ) : expenses.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No business expenses logged. Click "Add Expense" to log shop costs.
        </div>
      ) : (
        <section className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem', width: '140px' }}>Date</th>
                <th style={{ padding: '1rem' }}>Category</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Amount Spent (₹)</th>
                <th style={{ padding: '1rem' }}>Payment Method</th>
                <th style={{ padding: '1rem' }}>Description / Remarks</th>
                <th style={{ padding: '1rem', width: '80px', textAlign: 'center' }} className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.925rem' }}>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={13} />
                      {parseNaiveDate(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>{exp.category}</td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: 'var(--danger-text)' }}>
                    ₹{parseFloat(exp.amount).toFixed(2)}
                  </td>
                  <td style={{ padding: '1rem' }}>{exp.payment_method}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{exp.description || '-'}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }} className="no-print">
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                      <button 
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.4rem 0.65rem' }}
                        title="Edit expense details"
                        onClick={() => {
                          setEditingExpense(exp);
                          setEditCategory(exp.category);
                          setEditAmount(parseFloat(exp.amount).toString());
                          setEditMethod(exp.payment_method);
                          setEditDesc(exp.description || '');
                          setEditDate(exp.date ? exp.date.split('T')[0] : '');
                          setShowEditModal(true);
                        }}
                      >
                        Edit
                      </button>
                      <button 
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.4rem', color: 'var(--danger)' }}
                        title="Delete expense record"
                        onClick={() => handleDeleteExpense(exp)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Edit Expense Modal */}
      {showEditModal && editingExpense && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '440px', background: 'var(--bg-secondary)', animation: 'scaleUp 0.2s ease', padding: '2rem' }}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Edit Expense Record</h2>
              <button 
                type="button" 
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--text-secondary)' }}
                onClick={() => { setShowEditModal(false); setEditingExpense(null); }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateExpense}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Expense Category *</label>
                <select className="input-field" required value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                  <option value="Electricity (बिजली बिल)">Electricity (बिजली बिल)</option>
                  <option value="Water (पानी बिल)">Water (पानी बिल)</option>
                  <option value="Shop Rent (दुकान का किराया)">Shop Rent (दुकान का किराया)</option>
                  <option value="Staff Salaries (कर्मचारियों का वेतन)">Staff Salaries (कर्मचारियों का वेतन)</option>
                  <option value="Transportation (परिवहन / भाड़ा)">Transportation (परिवहन / भाड़ा)</option>
                  <option value="Cereals Buying Cash (अनाज नकद खरीद)">Cereals Buying Cash (अनाज नकद खरीद)</option>
                  <option value="Office Supplies (कार्यालय सामग्री)">Office Supplies (कार्यालय सामग्री)</option>
                  <option value="Other Business Expense (अन्य खर्च)">Other Business Expense (अन्य खर्च)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Amount Spent (₹) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input-field" 
                  required 
                  value={editAmount} 
                  onChange={e => setEditAmount(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Payment Mode</label>
                <select className="input-field" value={editMethod} onChange={e => setEditMethod(e.target.value)}>
                  <option value="Cash">Cash (नकद)</option>
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Bank">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Description / Remarks</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={editDesc} 
                  onChange={e => setEditDesc(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Expense Date</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={editDate} 
                  onChange={e => setEditDate(e.target.value)} 
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditingExpense(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--primary)', color: 'white' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global CSS styles for Print */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .glass-panel {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin-bottom: 0 !important;
            max-width: 100% !important;
          }
          .print-header {
            display: flex !important;
            justify-content: space-between !important;
            margin-bottom: 2rem !important;
            border-bottom: 2px solid #000 !important;
            padding-bottom: 1rem !important;
          }
          th, td {
            padding: 0.5rem !important;
          }
          /* Hide the actions columns during expense ledger printing */
          th:nth-child(6), td:nth-child(6) {
            display: none !important;
          }
        }
        @media screen {
          .print-header {
            display: none;
          }
        }
      `}</style>

    </div>
  );
};

export default ExpenseManager;
