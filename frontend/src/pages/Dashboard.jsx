import React, { useState, useEffect } from 'react';
import { customerAPI, productAPI, transactionAPI } from '../services/api';
import { PlusCircle, ArrowUpRight, DollarSign, Users, AlertTriangle, FileText, Upload } from 'lucide-react';

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

const Dashboard = ({ setCurrentPage, setSelectCustomerId }) => {
  const [metrics, setMetrics] = useState({
    todaySales: 0,
    todayCollection: 0,
    outstandingDue: 0,
    overdueCustomers: 0,
    lowStockCount: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Load customers to calculate outstanding
        const customers = await customerAPI.getCustomers();
        
        let outstanding = 0;
        let overdue = 0;
        customers.forEach(c => {
          const bal = parseFloat(c.current_balance) || 0;
          outstanding += bal;
          if (c.payment_type === 'Monthly Credit' && bal > 0) {
            overdue += 1; // Simplistic rule: credit customer with balance
          }
        });

        // Load products to calculate low stock count
        const products = await productAPI.getProducts();
        let lowStock = 0;
        products.forEach(p => {
          if ((parseFloat(p.current_stock) || 0) <= (parseFloat(p.minimum_stock) || 0)) {
            lowStock += 1;
          }
        });

        // Load Today's transactions
        const sales = await transactionAPI.getSales();
        const payments = await transactionAPI.getPayments();
        const todayStr = new Date().toDateString();

        let todaySalesSum = 0;
        let todayCollectionSum = 0;

        sales.forEach(s => {
          if (s.status === 'Active' && parseNaiveDate(s.sale_date).toDateString() === todayStr) {
            todaySalesSum += parseFloat(s.total_amount) || 0;
            todayCollectionSum += parseFloat(s.paid_amount) || 0;
          }
        });

        payments.forEach(p => {
          if (p.status === 'Active' && parseNaiveDate(p.payment_date).toDateString() === todayStr) {
            todayCollectionSum += parseFloat(p.amount) || 0;
          }
        });

        setMetrics({
          todaySales: todaySalesSum,
          todayCollection: todayCollectionSum,
          outstandingDue: outstanding,
          overdueCustomers: overdue,
          lowStockCount: lowStock
        });
      } catch (err) {
        console.error("Error loading dashboard data:", err);
        setError(err.message || "Failed to load dashboard statistics from backend.");
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '50vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading dashboard statistics...</p>
      </div>
    );
  }

  return (
    <div className="layout-container" style={{ animation: 'fadeIn 0.3s ease' }}>
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Connection/Server Error:</p>
          <p style={{ fontSize: '0.9rem' }}>{error}</p>
        </div>
      )}
      <header className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            Ganesh Traders
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Daily Business Dashboard</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="btn btn-primary"
            onClick={() => setCurrentPage('new-sale')}
          >
            <PlusCircle size={18} />
            New Sale (बिक्री)
          </button>
        </div>
      </header>

      {/* KPI Stats Grid */}
      <section className="dashboard-grid" style={{ marginBottom: '2.5rem' }}>
        <div className="glass-panel hover-card metrics-card-indigo" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Today's Sales</span>
            <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <ArrowUpRight size={12} /> Live
            </span>
          </div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 700 }}>₹{metrics.todaySales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Recorded sales invoices</p>
        </div>

        <div className="glass-panel hover-card metrics-card-emerald" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Today's Collection</span>
            <DollarSign size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 700 }}>₹{metrics.todayCollection.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Received cash & UPI payments</p>
        </div>

        <div className="glass-panel hover-card metrics-card-amber" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Total Customer Due</span>
            <Users size={18} style={{ color: 'var(--warning)' }} />
          </div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 700 }}>₹{metrics.outstandingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Outstanding credit ledger balance</p>
        </div>

        <div className="glass-panel hover-card metrics-card-rose" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Low Stock Alert</span>
            <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
          </div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 700 }}>{metrics.lowStockCount} Products</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Items below safety margins</p>
        </div>
      </section>

      {/* Main Operations / Quick Actions Grid */}
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Quick Actions</h3>
      <section className="dashboard-grid" style={{ marginBottom: '2.5rem' }}>
        <button 
          className="glass-panel hover-card" 
          style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          onClick={() => setCurrentPage('new-sale')}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContext: 'center', justifyContent: 'center' }}>
            <PlusCircle size={24} />
          </div>
          <div>
            <h4 style={{ fontWeight: 600, marginBottom: '0.15rem' }}>New Sale</h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>Add walk-in or credit sales</p>
          </div>
        </button>

        <button 
          className="glass-panel hover-card" 
          style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          onClick={() => setCurrentPage('customers')}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(217, 119, 6, 0.1)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContext: 'center', justifyContent: 'center' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <h4 style={{ fontWeight: 600, marginBottom: '0.15rem' }}>Receive Payment</h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>Record customer dues collection</p>
          </div>
        </button>

        <button 
          className="glass-panel hover-card" 
          style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          onClick={() => setCurrentPage('import-customers')}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(5, 150, 105, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContext: 'center', justifyContent: 'center' }}>
            <Upload size={24} />
          </div>
          <div>
            <h4 style={{ fontWeight: 600, marginBottom: '0.15rem' }}>Import Customers</h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>Upload existing Excel/CSV lists</p>
          </div>
        </button>

        <button 
          className="glass-panel hover-card" 
          style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
          onClick={() => setCurrentPage('customers')}
        >
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(2, 132, 199, 0.1)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContext: 'center', justifyContent: 'center' }}>
            <FileText size={24} />
          </div>
          <div>
            <h4 style={{ fontWeight: 600, marginBottom: '0.15rem' }}>Customer Ledger</h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>Print statements and verify dues</p>
          </div>
        </button>
      </section>
    </div>
  );
};

export default Dashboard;
