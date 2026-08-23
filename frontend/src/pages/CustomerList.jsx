import React, { useState, useEffect } from 'react';
import { customerAPI, transactionAPI } from '../services/api';
import { Search, Plus, CreditCard, ClipboardList, PhoneCall, MapPin, X, MessageCircle, Printer, Trash2 } from 'lucide-react';

const CustomerList = ({ setCurrentPage, setSelectCustomerId }) => {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // New Customer Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    mobile: '',
    address: '',
    customer_type: 'Retail',
    payment_type: 'Cash',
    opening_balance: '0.00',
    credit_limit: '0.00',
    notes: ''
  });
  
  // Receive Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const [message, setMessage] = useState({ text: '', type: '' });

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await customerAPI.getCustomers(search, typeFilter, paymentFilter);
      setCustomers(data);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to load customers.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [search, typeFilter, paymentFilter]);

  const handleSendReminder = (customer) => {
    const mobile = customer.mobile ? customer.mobile.replace(/[^0-9]/g, '') : '';
    const formattedMobile = mobile.length === 10 ? `91${mobile}` : mobile;
    const msg = `Hello ${customer.name},\nThis is a friendly reminder from *Ganesh Traders* that you have a pending outstanding balance of *Rs. ${parseFloat(customer.current_balance).toFixed(2)}* on your account ledger.\n\nPlease clear the balance at your earliest convenience using UPI or Cash at our store.\n\nThank you!\n*Ganesh Traders*`;
    const encodedText = encodeURIComponent(msg);
    const whatsappUrl = `https://wa.me/${formattedMobile}?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    try {
      // Validate mobile number if provided
      if (newCustomer.mobile && !/^\d{10}$/.test(newCustomer.mobile)) {
        setMessage({ text: 'Mobile number must be exactly 10 digits.', type: 'danger' });
        return;
      }
      
      await customerAPI.createCustomer({
        ...newCustomer,
        opening_balance: parseFloat(newCustomer.opening_balance || 0),
        credit_limit: parseFloat(newCustomer.credit_limit || 0)
      });

      setMessage({ text: 'Customer created successfully.', type: 'success' });
      setShowAddForm(false);
      setNewCustomer({
        name: '',
        mobile: '',
        address: '',
        customer_type: 'Retail',
        payment_type: 'Cash',
        opening_balance: '0.00',
        credit_limit: '0.00',
        notes: ''
      });
      loadCustomers();
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || 'Failed to create customer.';
      setMessage({ text: detail, type: 'danger' });
    }
  };

  const handleReceivePayment = async (e) => {
    e.preventDefault();
    if (!paymentTarget || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      setMessage({ text: 'Please enter a valid payment amount.', type: 'danger' });
      return;
    }

    try {
      await transactionAPI.receivePayment({
        customer_id: paymentTarget.id,
        amount: parseFloat(paymentAmount),
        payment_method: paymentMethod,
        reference_number: paymentRef,
        notes: paymentNotes
      });

      setMessage({ text: `Payment of ₹${paymentAmount} recorded successfully.`, type: 'success' });
      setShowPaymentModal(false);
      setPaymentTarget(null);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      loadCustomers();
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to save payment.', type: 'danger' });
    }
  };

  const handleDeleteCustomer = async (customer) => {
    const isDue = (parseFloat(customer.current_balance) || 0) > 0;
    const confirmMessage = isDue 
      ? `WARNING: Customer "${customer.name}" has an outstanding balance of ₹${parseFloat(customer.current_balance).toFixed(2)}.\n\nAre you sure you want to delete this customer? This will hide them from the directory.`
      : `Are you sure you want to delete customer "${customer.name}"?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await customerAPI.deleteCustomer(customer.id);
      setMessage({ text: `Customer "${customer.name}" deleted successfully.`, type: 'success' });
      loadCustomers();
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || 'Failed to delete customer.';
      setMessage({ text: detail, type: 'danger' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="layout-container" style={{ animation: 'fadeIn 0.25s ease' }}>
      <header className="flex-between no-print" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Customer Master</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage profiles, ledger sheets, and collect payments</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handlePrint}>
            <Printer size={16} /> Print Directory
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </header>

      {/* Print-Only Header */}
      <div className="print-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>CUSTOMER OUTSTANDING DUES DIRECTORY</h1>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>Ganesh Traders — Credit Accounts Ledger</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Date: {new Date().toLocaleDateString('en-IN')}</p>
        </div>
      </div>

      {message.text && (
        <div className={`badge badge-${message.type}`} style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'block', textTransform: 'none' }}>
          {message.text}
        </div>
      )}

      {/* Inline Add Customer Form */}
      {showAddForm && (
        <form className="glass-panel" onSubmit={handleCreateCustomer} style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input type="text" className="input-field" required value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Mobile Number</label>
            <input type="text" className="input-field" placeholder="10-digit number" value={newCustomer.mobile} onChange={e => setNewCustomer({ ...newCustomer, mobile: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input type="text" className="input-field" value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Customer Type</label>
            <select className="input-field" value={newCustomer.customer_type} onChange={e => setNewCustomer({ ...newCustomer, customer_type: e.target.value })}>
              <option value="Retail">Retail (फुटकर)</option>
              <option value="Wholesale">Wholesale (थोक)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Payment Terms</label>
            <select className="input-field" value={newCustomer.payment_type} onChange={e => setNewCustomer({ ...newCustomer, payment_type: e.target.value })}>
              <option value="Cash">Cash (नकद)</option>
              <option value="Monthly Credit">Monthly Credit (उधार खाता)</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Opening Balance (₹)</label>
            <input type="number" step="0.01" className="input-field" value={newCustomer.opening_balance} onChange={e => setNewCustomer({ ...newCustomer, opening_balance: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Credit Limit (₹)</label>
            <input type="number" step="0.01" className="input-field" value={newCustomer.credit_limit} onChange={e => setNewCustomer({ ...newCustomer, credit_limit: e.target.value })} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notes</label>
            <input type="text" className="input-field" placeholder="Any special instructions..." value={newCustomer.notes} onChange={e => setNewCustomer({ ...newCustomer, notes: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Profile</button>
          </div>
        </form>
      )}

      {/* Directory Searches and Filters */}
      <section className="glass-panel" style={{ marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by name, mobile or code..." 
            style={{ paddingLeft: '2.5rem' }} 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        
        <select className="input-field" style={{ width: '160px' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="Retail">Retail</option>
          <option value="Wholesale">Wholesale</option>
        </select>

        <select className="input-field" style={{ width: '180px' }} value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
          <option value="">All Payment Types</option>
          <option value="Cash">Cash Only</option>
          <option value="Monthly Credit">Monthly Credit</option>
        </select>
      </section>

      {/* Customers List Table */}
      <section className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading directory...</p>
        ) : customers.length === 0 ? (
          <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No customers found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '1rem' }}>Code</th>
                <th style={{ padding: '1rem' }}>Name</th>
                <th style={{ padding: '1rem' }}>Mobile / Address</th>
                <th style={{ padding: '1rem' }}>Profile Type</th>
                <th style={{ padding: '1rem' }}>Payment Cycle</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Current Balance</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }} className="hover-card">
                  <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--primary)' }}>{c.customer_code}</td>
                  <td style={{ padding: '1rem', fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <PhoneCall size={12} /> {c.mobile || 'N/A'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      <MapPin size={12} /> {c.address || 'Local shop'}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge ${c.customer_type === 'Wholesale' ? 'badge-info' : 'badge-success'}`}>
                      {c.customer_type}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 500, fontSize: '0.875rem' }}>{c.payment_type}</td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: parseFloat(c.current_balance) > 0 ? 'var(--danger-text)' : 'inherit' }}>
                    ₹{parseFloat(c.current_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      {parseFloat(c.current_balance) > 0 && (
                        <>
                          <button 
                            className="btn btn-whatsapp btn-sm" 
                            title="Send WhatsApp Reminder"
                            onClick={() => handleSendReminder(c)}
                          >
                            <MessageCircle size={14} /> Alert
                          </button>
                          
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ color: 'var(--success-text)', background: 'var(--success-bg)' }}
                            onClick={() => {
                              setPaymentTarget(c);
                              setPaymentAmount(c.current_balance);
                              setShowPaymentModal(true);
                            }}
                          >
                            <CreditCard size={14} /> Pay
                          </button>
                        </>
                      )}
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSelectCustomerId(c.id);
                          setCurrentPage('ledger');
                        }}
                      >
                        <ClipboardList size={14} /> Ledger
                      </button>
                      
                      <button 
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fee2e2' }}
                        onClick={() => handleDeleteCustomer(c)}
                        title="Delete Customer"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Receive Payment Modal */}
      {showPaymentModal && paymentTarget && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '440px', background: 'var(--bg-secondary)', animation: 'scaleUp 0.2s ease' }}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Collect Payment</h2>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowPaymentModal(false)} />
            </div>
            
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Receive dues from <strong style={{ color: 'var(--text-primary)' }}>{paymentTarget.name}</strong> ({paymentTarget.customer_code})
            </p>
            
            <form onSubmit={handleReceivePayment}>
              <div className="form-group">
                <label className="form-label">Payment Amount (₹) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input-field" 
                  required 
                  max={paymentTarget.current_balance}
                  value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select className="input-field" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="Cash">Cash (नकद)</option>
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Bank">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Reference Number (if UPI/Bank)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Transaction ID / Receipt No" 
                  value={paymentRef} 
                  onChange={e => setPaymentRef(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Paid in full for July" 
                  value={paymentNotes} 
                  onChange={e => setPaymentNotes(e.target.value)} 
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--success)', color: 'white' }}>Confirm Payment</button>
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
          /* Hide the actions columns during prints */
          th:nth-child(7), td:nth-child(7) {
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

export default CustomerList;
