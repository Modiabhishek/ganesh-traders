import React, { useState, useEffect } from 'react';
import { transactionAPI } from '../services/api';
import { Search, Printer, Trash2, ArrowLeft, Loader, Calendar, FileText, CheckCircle, XCircle } from 'lucide-react';

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

const TransactionHistory = ({ setCurrentPage, goBack }) => {
  const [tab, setTab] = useState('sales'); // 'sales' or 'payments'
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Reprint modal state
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  const loadTransactions = async () => {
    setLoading(true);
    try {
      if (tab === 'sales') {
        const salesData = await transactionAPI.getSales();
        setSales(salesData);
      } else {
        const paymentsData = await transactionAPI.getPayments();
        setPayments(paymentsData);
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to load transaction logs.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [tab]);

  const handleVoidSale = async (sale) => {
    const reason = window.prompt(`Are you sure you want to void sale '${sale.sale_number}'? This will restore inventory stock and reduce this customer's dues balance. Please enter a reason:`);
    if (reason === null) return; // cancelled prompt
    
    setMessage({ text: '', type: '' });
    try {
      await transactionAPI.cancelSale(sale.id, reason || 'Voided by user');
      setMessage({ text: `Sale '${sale.sale_number}' has been successfully voided and reversed.`, type: 'success' });
      loadTransactions();
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to void sale invoice.', type: 'danger' });
    }
  };

  const handleVoidPayment = async (pay) => {
    if (!window.confirm(`Are you sure you want to void payment '${pay.payment_number}'? This will add the paid amount of ₹${pay.amount} back to the customer's outstanding balance.`)) {
      return;
    }
    setMessage({ text: '', type: '' });
    try {
      await transactionAPI.cancelPayment(pay.id);
      setMessage({ text: `Payment '${pay.payment_number}' voided successfully. Customer balance restored.`, type: 'success' });
      loadTransactions();
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to void payment record.', type: 'danger' });
    }
  };

  const triggerPrint = () => {
    window.print();
  };

  // Filter local listings based on search
  const filteredSales = sales.filter(s => 
    s.sale_number.toLowerCase().includes(search.toLowerCase()) ||
    (s.customer_name && s.customer_name.toLowerCase().includes(search.toLowerCase())) ||
    s.payment_method.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPayments = payments.filter(p => 
    p.payment_number.toLowerCase().includes(search.toLowerCase()) ||
    (p.customer_name && p.customer_name.toLowerCase().includes(search.toLowerCase())) ||
    p.payment_method.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="layout-container" style={{ animation: 'fadeIn 0.25s ease' }}>
      
      {/* Screen Header */}
      <header className="flex-between no-print" style={{ marginBottom: '1.5rem' }}>
        <button className="btn btn-secondary" onClick={goBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Transaction History — Ganesh Traders</h1>
        <button className="btn btn-secondary" onClick={triggerPrint}>
          <Printer size={16} /> Print Report
        </button>
      </header>

      {/* Print-Only Header */}
      <div className="print-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {tab === 'sales' ? 'DAILY SALES INVOICES REPORT' : 'CUSTOMER PAYMENTS COLLECTION REPORT'}
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>Ganesh Traders — Daily Ledger Book</p>
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

      {/* Screen Tabs Bar */}
      <section style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }} className="no-print">
        <button 
          className={`btn ${tab === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setTab('sales'); setSearch(''); }}
        >
          <FileText size={16} /> Sales Invoices (बिक्री रसीद)
        </button>
        <button 
          className={`btn ${tab === 'payments' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setTab('payments'); setSearch(''); }}
        >
          <Calendar size={16} /> Payment Log (भुगतान संग्रह)
        </button>
      </section>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '1.5rem', maxWidth: '400px' }} className="no-print">
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          className="input-field" 
          placeholder={`Search by code, customer name, payment mode...`}
          style={{ paddingLeft: '2.5rem' }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Transactions Data Tables */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }} className="no-print">
          <Loader className="spin" size={24} style={{ marginRight: '0.5rem' }} /> Loading records history...
        </div>
      ) : tab === 'sales' ? (
        filteredSales.length === 0 ? (
          <div className="glass-panel text-center no-print" style={{ padding: '3rem', color: 'var(--text-muted)' }}>
            No sales records matched.
          </div>
        ) : (
          <section className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '1rem', width: '120px' }}>Sale ID</th>
                  <th style={{ padding: '1rem' }}>Date & Time</th>
                  <th style={{ padding: '1rem' }}>Customer</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Total (₹)</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Paid (₹)</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Due (₹)</th>
                  <th style={{ padding: '1rem' }}>Mode</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '1rem', width: '120px', textAlign: 'right' }} className="no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.925rem' }}>
                    <td style={{ padding: '1rem', fontFamily: 'monospace', fontWeight: 600 }}>{s.sale_number}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      {parseNaiveDate(s.sale_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <strong>{s.customer_name || 'Walk-in Cash Customer'}</strong>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>₹{parseFloat(s.total_amount).toFixed(2)}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--success)' }}>₹{parseFloat(s.paid_amount).toFixed(2)}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: parseFloat(s.due_amount) > 0 ? 'var(--danger-text)' : 'inherit' }}>
                      ₹{parseFloat(s.due_amount).toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem' }}>{s.payment_method}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span className={`badge ${
                        s.payment_status === 'PAID' ? 'badge-success' :
                        s.payment_status === 'PARTIALLY PAID' ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {s.payment_status}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }} className="no-print">
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.4rem' }}
                          title="Print / View Invoice"
                          onClick={() => setActiveInvoice(s)}
                        >
                          <Printer size={14} />
                        </button>
                        
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.4rem', color: 'var(--danger)' }}
                          title="Void Sale"
                          onClick={() => handleVoidSale(s)}
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
        )
      ) : (
        filteredPayments.length === 0 ? (
          <div className="glass-panel text-center no-print" style={{ padding: '3rem', color: 'var(--text-muted)' }}>
            No payment collection logs found.
          </div>
        ) : (
          <section className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '1rem', width: '120px' }}>Receipt ID</th>
                  <th style={{ padding: '1rem' }}>Date & Time</th>
                  <th style={{ padding: '1rem' }}>Customer</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Collected (₹)</th>
                  <th style={{ padding: '1rem' }}>Method</th>
                  <th style={{ padding: '1rem' }}>Reference No.</th>
                  <th style={{ padding: '1rem' }}>Notes / Remarks</th>
                  <th style={{ padding: '1rem', width: '80px', textAlign: 'right' }} className="no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.925rem' }}>
                    <td style={{ padding: '1rem', fontFamily: 'monospace', fontWeight: 600 }}>{p.payment_number}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      {parseNaiveDate(p.payment_date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <strong>{p.customer_name}</strong>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                      ₹{parseFloat(p.amount).toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem' }}>{p.payment_method}</td>
                    <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>{p.reference_number || '-'}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.notes || '-'}</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }} className="no-print">
                      <button 
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.4rem', color: 'var(--danger)' }}
                        title="Void Payment Collection"
                        onClick={() => handleVoidPayment(p)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      )}

      {/* Invoice Printer Drawer Modal Overlay */}
      {activeInvoice && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} className="no-print-overlay">
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', background: 'white', color: '#000', padding: '2rem', animation: 'scaleUp 0.25s ease', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', border: '1px solid #ddd' }}>
            
            {/* Action buttons (Hidden during prints) */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginBottom: '1.5rem' }} className="no-print">
              <button className="btn btn-primary" onClick={triggerPrint}>
                <Printer size={16} /> Print Receipt
              </button>
              <button className="btn btn-secondary" onClick={() => setActiveInvoice(null)}>
                Close
              </button>
            </div>

            {/* Printable Receipt Layout */}
            <div id="invoice-receipt-print" style={{ fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.4' }}>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem', borderBottom: '1px dashed #000', paddingBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0.2rem 0' }}>GANESH TRADERS</h2>
                <p style={{ fontSize: '0.8rem', color: '#555' }}>Daily Grocery, Poojs & Household Needs</p>
                <p style={{ fontSize: '0.8rem', color: '#555' }}>Mobile: +91 98765 43210</p>
              </div>

              <div style={{ marginBottom: '1rem', borderBottom: '1px dashed #000', paddingBottom: '0.5rem' }}>
                <p><strong>Invoice ID:</strong> {activeInvoice.sale_number}</p>
                <p><strong>Date:</strong> {parseNaiveDate(activeInvoice.sale_date).toLocaleString('en-IN')}</p>
                <p><strong>Customer:</strong> {activeInvoice.customer_name || 'Walk-in Cash Customer'}</p>
              </div>

              {/* Invoice lines summary */}
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '1rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px dashed #000' }}>
                    <th style={{ paddingBottom: '0.25rem' }}>Item</th>
                    <th style={{ paddingBottom: '0.25rem', textAlign: 'center' }}>Qty</th>
                    <th style={{ paddingBottom: '0.25rem', textAlign: 'right' }}>Rate</th>
                    <th style={{ paddingBottom: '0.25rem', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {activeInvoice.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '0.25rem 0' }}>{item.product_name}</td>
                      <td style={{ padding: '0.25rem 0', textAlign: 'center' }}>{parseFloat(item.quantity).toFixed(0)}</td>
                      <td style={{ padding: '0.25rem 0', textAlign: 'right' }}>₹{parseFloat(item.price).toFixed(2)}</td>
                      <td style={{ padding: '0.25rem 0', textAlign: 'right' }}>₹{parseFloat(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: '1px dashed #000', paddingTop: '0.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>₹{parseFloat(activeInvoice.subtotal || activeInvoice.total_amount).toFixed(2)}</span>
                </div>
                {parseFloat(activeInvoice.discount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
                    <span>Discount:</span>
                    <span>-₹{parseFloat(activeInvoice.discount).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1rem', borderTop: '1px solid #000', paddingTop: '0.25rem', marginTop: '0.25rem' }}>
                  <span>Grand Total:</span>
                  <span>₹{parseFloat(activeInvoice.total_amount).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'green', marginTop: '0.25rem' }}>
                  <span>Amt Received ({activeInvoice.payment_method}):</span>
                  <span>₹{parseFloat(activeInvoice.paid_amount).toFixed(2)}</span>
                </div>
                {parseFloat(activeInvoice.due_amount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'red', fontWeight: 'bold' }}>
                    <span>Balance Due:</span>
                    <span>₹{parseFloat(activeInvoice.due_amount).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center', marginTop: '2rem', borderTop: '1px dashed #000', paddingTop: '1rem' }}>
                <p>Thank You! Visit Again.</p>
                <p style={{ fontSize: '0.75rem', color: '#777' }}>Powered by Vyapaar Manager</p>
              </div>
            </div>

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
          ${activeInvoice ? `
            body * {
              visibility: hidden;
              background: transparent !important;
            }
            #invoice-receipt-print, #invoice-receipt-print * {
              visibility: visible;
            }
            #invoice-receipt-print {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 1cm;
              margin: 0;
            }
            .no-print-overlay {
              background: white !important;
              position: absolute !important;
              padding: 0 !important;
            }
            .no-print-overlay > div {
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
              max-width: 100% !important;
            }
          ` : `
            /* Hide the actions columns during transaction listing prints */
            th:nth-child(9), td:nth-child(9),
            th:nth-child(8), td:nth-child(8) {
              display: none !important;
            }
          `}
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

export default TransactionHistory;
