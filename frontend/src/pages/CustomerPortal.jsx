import React, { useState, useEffect } from 'react';
import { customerAPI } from '../services/api';
import { LogOut, Printer, RefreshCw, ClipboardList, TrendingDown, Bell, CheckCircle } from 'lucide-react';

const CUSTOMER_QUOTES = [
  "Your trust is our greatest asset. Thank you for choosing Ganesh Traders!",
  "Quality is remembered long after the price is forgotten. We believe in premium products.",
  "Satisfaction is a rating. Loyalty is a brand. We value your loyalty!",
  "We don't want to make a single sale, we want to build a lifelong relationship.",
  "Honesty & Trust is the foundation of our business. Thank you for being part of our family!",
  "A satisfied customer is the best business strategy of all."
];

const CustomerPortal = ({ token, onLogout }) => {
  const [customer, setCustomer] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState('');
  const [message, setMessage] = useState('');

  const loadPortalData = async () => {
    setLoading(true);
    try {
      // 1. Load customer profile details
      const profile = await customerAPI.getPortalProfile();
      setCustomer(profile);

      // 2. Load customer ledger transactions
      const ledgerData = await customerAPI.getLedger(profile.id);
      setLedger(ledgerData.ledger || []);

      // 3. Load live updates posted by Admin
      const updates = await customerAPI.getLiveUpdates();
      setLiveUpdates(updates || []);
    } catch (err) {
      console.error(err);
      setMessage('Failed to load portal updates. Make sure you are connected.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
    // Choose a random quote
    const randIndex = Math.floor(Math.random() * CUSTOMER_QUOTES.length);
    setQuote(CUSTOMER_QUOTES[randIndex]);
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ borderTopColor: 'var(--primary)', width: '40px', height: '40px', borderWidth: '4px', animation: 'spin 1s linear infinite', borderRadius: '50%', borderStyle: 'solid', borderColor: '#e2e8f0', margin: '0 auto 1rem' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const currentBalance = parseFloat(customer?.current_balance || 0);

  return (
    <div className="layout-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem', animation: 'fadeIn 0.25s ease' }}>
      
      {/* Portal Header */}
      <header className="flex-between no-print" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>Ganesh Traders (ग्राहक पोर्टल)</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Welcome back, <strong>{customer?.name}</strong>!</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={loadPortalData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={16} /> Print Statement
          </button>
          <button className="btn btn-secondary" style={{ color: '#b91c1c' }} onClick={onLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Print Statement Header Banner */}
      <div className="print-header">
        <div style={{ borderBottom: '2px solid black', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, textAlign: 'center', letterSpacing: '1px' }}>GANESH TRADERS</h1>
          <p style={{ textAlign: 'center', fontSize: '0.9rem', color: '#555' }}>Customer Account Statement & Ledger</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', fontSize: '0.925rem' }}>
            <div>
              <p><strong>Customer Name:</strong> {customer?.name}</p>
              <p><strong>Customer Code:</strong> {customer?.customer_code}</p>
              <p><strong>Mobile:</strong> {customer?.mobile || 'N/A'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p><strong>Statement Date:</strong> {new Date().toLocaleDateString('en-IN')}</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 700 }}><strong>Outstanding Balance:</strong> ₹{currentBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div className="badge badge-danger" style={{ width: '100%', padding: '1rem', marginBottom: '1.5rem', display: 'block', textTransform: 'none' }}>
          {message}
        </div>
      )}

      {/* Dues Alert & Quote Grid */}
      <section className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Due Notification Box */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderLeft: currentBalance > 0 ? '5px solid #eab308' : '5px solid var(--success)' }}>
          {currentBalance > 0 ? (
            <div>
              <span className="badge badge-warning" style={{ marginBottom: '0.75rem' }}>Pending Dues (उधार राशि)</span>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#a16207', marginBottom: '0.5rem' }}>
                ₹{currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h2>
              <p style={{ fontSize: '0.925rem', color: '#713f12', lineHeight: '1.4' }}>
                Dear <strong>{customer?.name}</strong>, you have a pending due on your account. Please clear it at your earliest convenience using UPI or cash at our store. 
              </p>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.75rem' }}>
                Thank you for shopping with Ganesh Traders!
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <CheckCircle size={44} style={{ color: 'var(--success)', marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success-text)' }}>All Settled!</h3>
              <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                No outstanding dues on your account. Thank you for shopping with Ganesh Traders!
              </p>
            </div>
          )}
        </div>

        {/* Quotes Box */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.05), rgba(var(--primary-rgb), 0.01))' }}>
          <span style={{ fontSize: '1.75rem', color: 'var(--primary)', lineHeight: 1, fontFamily: 'serif' }}>“</span>
          <p style={{ fontSize: '1rem', fontStyle: 'italic', fontWeight: 500, color: 'var(--text-primary)', marginTop: '-0.5rem', lineHeight: '1.5' }}>
            {quote}
          </p>
          <span style={{ fontSize: '1.75rem', color: 'var(--primary)', alignSelf: 'flex-end', lineHeight: 1, marginTop: '-0.5rem', fontFamily: 'serif' }}>”</span>
        </div>

      </section>

      {/* Live Updates Section (Updates from Admin Side) */}
      <section className="no-print" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Bell size={20} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Live Store Updates & Announcements (घोषणाएं)</h2>
        </div>
        {liveUpdates.length === 0 ? (
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No live updates posted yet by the store management.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {liveUpdates.map(update => (
              <div key={update.id} className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary)' }}>
                <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{update.title}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(update.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{update.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Transactions & Ledger */}
      <section className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }} className="no-print">
          <ClipboardList size={20} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Your Account Ledger (खाता विवरण)</h2>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem' }}>Date</th>
                <th style={{ padding: '1rem' }}>Type</th>
                <th style={{ padding: '1rem' }}>Reference No</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Debit (₹ Amount)</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Credit (₹ Paid)</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Balance (Dues)</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }} className="hover-card">
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                    {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>{item.type}</td>
                  <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{item.reference}</td>
                  <td style={{ padding: '1rem', textAlign: 'right', color: item.debit > 0 ? '#b91c1c' : 'inherit' }}>
                    {item.debit > 0 ? `₹${parseFloat(item.debit).toFixed(2)}` : '-'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', color: item.credit > 0 ? 'var(--success-text)' : 'inherit' }}>
                    {item.credit > 0 ? `₹${parseFloat(item.credit).toFixed(2)}` : '-'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700 }}>
                    ₹{parseFloat(item.running_balance).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Global CSS for Print */}
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
            display: block !important;
          }
          th, td {
            padding: 0.5rem !important;
            border-bottom: 1px solid #ddd !important;
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

export default CustomerPortal;
