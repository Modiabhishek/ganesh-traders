import React, { useState, useEffect } from 'react';
import { customerAPI } from '../services/api';
import { ArrowLeft, Printer, Phone, Calendar, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

const parseNaiveDate = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  try {
    let workingStr = dateStr;
    if (!dateStr.includes('Z') && !dateStr.includes('+')) {
      workingStr = dateStr + 'Z';
    }
    return new Date(workingStr);
  } catch (e) {
    return new Date(dateStr);
  }
};

const Ledger = ({ customerId, setCurrentPage, goBack }) => {
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLedger = async () => {
    try {
      setLoading(true);
      const data = await customerAPI.getLedger(customerId);
      setLedgerData(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load ledger history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      loadLedger();
    }
  }, [customerId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="layout-container" style={{ textAlign: 'center', padding: '4rem' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading ledger statement...</p>
      </div>
    );
  }

  if (error || !ledgerData) {
    return (
      <div className="layout-container" style={{ textAlign: 'center', padding: '4rem' }}>
        <p style={{ color: 'var(--danger)' }}>{error || 'No customer selected.'}</p>
        <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => setCurrentPage('customers')}>
          <ArrowLeft size={16} /> Back to Directory
        </button>
      </div>
    );
  }

  const { customer, ledger } = ledgerData;

  return (
    <div className="layout-container" style={{ animation: 'fadeIn 0.25s ease' }}>
      {/* Hide elements when printing */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .glass-panel {
            background: white !important;
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
        }
        @media screen {
          .print-header {
            display: none;
          }
        }
      `}</style>

      {/* Screen Toolbar */}
      <header className="flex-between no-print" style={{ marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={goBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handlePrint}>
            <Printer size={16} /> Print Statement
          </button>
        </div>
      </header>

      {/* Print-Only Header */}
      <div className="print-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>ACCOUNT LEDGER STATEMENT</h1>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>Ganesh Traders — Grocery & Pooja Needs</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Date: {new Date().toLocaleDateString('en-IN')}</p>
        </div>
      </div>

      {/* Customer Information Card */}
      <section className="glass-panel" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Customer Profile</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', marginBottom: '0.5rem' }}>{customer.name}</h2>
            {customer.fathers_name && (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                <strong>पिता:</strong> {customer.fathers_name}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <Phone size={14} /> {customer.mobile || 'No Phone'}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Account Reference</span>
            <p style={{ fontSize: '1.15rem', fontWeight: 600, marginTop: '0.25rem', marginBottom: '0.25rem' }}>{customer.customer_code}</p>
            {customer.reference && (
              <p style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 500, marginBottom: '0.25rem' }}>
                <strong>संदर्भ:</strong> {customer.reference}
              </p>
            )}
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Type: {customer.opening_balance > 0 ? 'Balance carried forward' : 'Regular'}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Opening Balance</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
              ₹{parseFloat(customer.opening_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Current Outstanding</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--danger-text)' }}>
              ₹{parseFloat(customer.current_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>
      </section>

      {/* Ledger Log Transactions Table */}
      <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem' }} className="no-print">Ledger History (खाता विवरण)</h3>
      <section className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ padding: '1rem', width: '140px' }}>Date</th>
              <th style={{ padding: '1rem' }}>Type</th>
              <th style={{ padding: '1rem' }}>Reference</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>Debit (+) (खरीद)</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>Credit (-) (भुगतान)</th>
              <th style={{ padding: '1rem', textAlign: 'right', width: '160px' }}>Balance Due</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((t, idx) => {
              const dateObj = parseNaiveDate(t.date);
              const formattedDate = isNaN(dateObj.getTime()) ? 'Go-Live' : dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
              
              return (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={13} /> {formattedDate}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 500 }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {t.type === 'Sale' ? (
                          <ArrowUpCircle size={15} style={{ color: 'var(--danger)' }} />
                        ) : t.type.startsWith('Payment') ? (
                          <ArrowDownCircle size={15} style={{ color: 'var(--success)' }} />
                        ) : null}
                        {t.type}
                      </div>
                      {t.items && t.items.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '0.25rem', paddingLeft: '1.4rem' }}>
                          {t.items.map(item => `${item.product_name} (${item.quantity} ${item.unit || 'piece'})`).join(', ')}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t.reference}</td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 500, color: parseFloat(t.debit) > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {parseFloat(t.debit) > 0 ? `₹${parseFloat(t.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 500, color: parseFloat(t.credit) > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                    {parseFloat(t.credit) > 0 ? `₹${parseFloat(t.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700 }}>
                    ₹{parseFloat(t.running_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Summary Footer for Print */}
      <footer className="print-header" style={{ borderBottom: 'none', borderTop: '2px solid #000', marginTop: '3rem', paddingTop: '1rem', fontSize: '0.9rem' }}>
        <div>
          <p>Father's Signature: _______________________</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p>Customer Signature: _______________________</p>
        </div>
      </footer>
    </div>
  );
};

export default Ledger;
