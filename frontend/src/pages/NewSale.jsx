import React, { useState, useEffect } from 'react';
import { customerAPI, productAPI, transactionAPI } from '../services/api';
import { ArrowLeft, Trash2, Search, PlusCircle, Check, DollarSign, ListCollapse } from 'lucide-react';

const NewSale = ({ setCurrentPage, goBack }) => {
  const [saleMode, setSaleMode] = useState('quick'); // 'quick' or 'detailed'

  // Common customer state
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null); // null means Walk-in Customer
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustDropdown, setShowCustDropdown] = useState(false);

  // Quick mode states
  const [quickTotal, setQuickTotal] = useState('');
  const [generalProductId, setGeneralProductId] = useState(null);

  // Detailed mode states
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState('0.00');
  const [paidAmount, setPaidAmount] = useState('0.00');

  // Shared state
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [message, setMessage] = useState({ text: '', type: '' });

  // Load General Grocery Item ID for Quick Cash sales
  useEffect(() => {
    const fetchGeneralProduct = async () => {
      try {
        const prodList = await productAPI.getProducts('General Grocery Item');
        const general = prodList.find(p => p.product_code === 'PROD-GENERAL');
        if (general) {
          setGeneralProductId(general.id);
        }
      } catch (err) {
        console.error("Error loading general product details:", err);
      }
    };
    fetchGeneralProduct();
  }, []);

  useEffect(() => {
    // Load customers for selection dropdown
    const loadCustomers = async () => {
      try {
        const data = await customerAPI.getCustomers(customerSearch);
        setCustomers(data);
      } catch (err) {
        console.error(err);
      }
    };
    if (customerSearch) {
      loadCustomers();
    }
  }, [customerSearch]);

  useEffect(() => {
    // Load products for item dropdown
    const loadProducts = async () => {
      try {
        const data = await productAPI.getProducts(productSearch);
        setProducts(data);
      } catch (err) {
        console.error(err);
      }
    };
    if (productSearch) {
      loadProducts();
    }
  }, [productSearch]);

  // Totals calculations for detailed cart
  const calculateSubtotal = () => {
    return cart.reduce((acc, item) => acc + (parseFloat(item.price) * parseFloat(item.quantity)), 0);
  };

  const subtotal = calculateSubtotal();
  const discNum = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discNum);
  const paidNum = parseFloat(paidAmount) || 0;
  const dueAmount = Math.max(0, total - paidNum);

  const handleAddProductToCart = (prod) => {
    const exists = cart.find(item => item.product_id === prod.id);
    if (exists) {
      setCart(cart.map(item => 
        item.product_id === prod.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: prod.id,
        name: prod.name,
        price: prod.selling_price,
        quantity: 1,
        unit: prod.unit
      }]);
    }
    setProductSearch('');
    setShowProdDropdown(false);
  };

  const handleUpdateQuantity = (prodId, val) => {
    const q = parseFloat(val) || 0;
    if (q <= 0) {
      setCart(cart.filter(item => item.product_id !== prodId));
    } else {
      setCart(cart.map(item => 
        item.product_id === prodId ? { ...item, quantity: q } : item
      ));
    }
  };

  const handleUpdatePrice = (prodId, val) => {
    const p = parseFloat(val) || 0;
    setCart(cart.map(item => 
      item.product_id === prodId ? { ...item, price: p } : item
    ));
  };

  const handleRemoveItem = (prodId) => {
    setCart(cart.filter(item => item.product_id !== prodId));
  };

  const handleSaveQuickSale = async (e) => {
    e.preventDefault();
    const amountVal = parseFloat(quickTotal) || 0;
    if (amountVal <= 0) {
      setMessage({ text: 'Please enter a valid bill amount.', type: 'danger' });
      return;
    }
    if (!generalProductId) {
      setMessage({ text: 'General product ID not found. Seeds are missing.', type: 'danger' });
      return;
    }

    try {
      await transactionAPI.createSale({
        customer_id: selectedCustomer ? selectedCustomer.id : null,
        items: [{
          product_id: generalProductId,
          quantity: 1,
          price: amountVal
        }],
        discount: 0,
        paid_amount: amountVal,
        payment_method: paymentMethod
      });

      setMessage({ text: `Quick sale of Rs. ${amountVal} recorded successfully.`, type: 'success' });
      setQuickTotal('');
      setSelectedCustomer(null);
      setCustomerSearch('');
      setPaymentMethod('Cash');
      
      setTimeout(() => {
        setCurrentPage('dashboard');
      }, 1200);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to record cash sale.', type: 'danger' });
    }
  };

  const handleSaveDetailedSale = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setMessage({ text: 'Please add at least one product to the sale.', type: 'danger' });
      return;
    }

    try {
      await transactionAPI.createSale({
        customer_id: selectedCustomer ? selectedCustomer.id : null,
        items: cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: parseFloat(item.price)
        })),
        discount: discNum,
        paid_amount: paidNum,
        payment_method: paymentMethod
      });

      setMessage({ text: 'Sale invoice saved successfully. Inventory and ledger updated!', type: 'success' });
      setCart([]);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setDiscount('0.00');
      setPaidAmount('0.00');
      setPaymentMethod('Cash');
      
      setTimeout(() => {
        goBack();
      }, 1200);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || 'Failed to complete sale transaction.';
      setMessage({ text: detail, type: 'danger' });
    }
  };

  return (
    <div className="layout-container" style={{ animation: 'fadeIn 0.25s ease' }}>
      <header className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <button className="btn btn-secondary" onClick={goBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>POS Sale Invoice — Ganesh Traders</h1>
      </header>

      {message.text && (
        <div className={`badge badge-${message.type}`} style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'block', textTransform: 'none' }}>
          {message.text}
        </div>
      )}

      {/* Sale Mode Tab Selectors */}
      <section style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }} className="no-print">
        <button 
          className={`btn ${saleMode === 'quick' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setSaleMode('quick');
            setSelectedCustomer(null);
            setCustomerSearch('');
            setPaymentMethod('Cash');
          }}
        >
          <DollarSign size={16} /> Quick Cash Sale (नकद बिक्री)
        </button>
        <button 
          className={`btn ${saleMode === 'detailed' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setSaleMode('detailed');
            setSelectedCustomer(null);
            setCustomerSearch('');
            setPaymentMethod('Cash');
          }}
        >
          <PlusCircle size={16} /> Detailed Sale (विवरण के साथ)
        </button>
      </section>

      {/* Customer Selection Block */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Select Customer (ग्राहक)</h2>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="input-field" 
                placeholder="Type to search credit customer... (e.g. Ramesh)"
                style={{ paddingLeft: '2.5rem' }}
                value={customerSearch}
                onChange={e => {
                  setCustomerSearch(e.target.value);
                  setShowCustDropdown(true);
                }}
                onFocus={() => setShowCustDropdown(true)}
              />
            </div>
            <button 
              type="button" 
              className={`btn ${!selectedCustomer ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setSelectedCustomer(null);
                setCustomerSearch('');
                setPaymentMethod('Cash');
              }}
            >
              {!selectedCustomer ? <Check size={16} /> : null} Walk-in Customer
            </button>
          </div>

          {showCustDropdown && customerSearch && (
            <div className="glass-panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '0.25rem', padding: '0.5rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
              {customers.length === 0 ? (
                <p style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No customer found.</p>
              ) : (
                customers.map(c => (
                  <div 
                    key={c.id} 
                    style={{ padding: '0.625rem 0.875rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
                    className="hover-card"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerSearch(c.name);
                      setShowCustDropdown(false);
                      if (c.payment_type === 'Monthly Credit') {
                        setPaymentMethod('Credit');
                      } else {
                        setPaymentMethod('Cash');
                      }
                    }}
                  >
                    <strong style={{ fontSize: '0.95rem' }}>{c.name}</strong> ({c.customer_code}) 
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>- Mobile: {c.mobile || 'N/A'}</span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      Outstanding: ₹{parseFloat(c.current_balance).toFixed(2)} | Terms: {c.payment_type}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {selectedCustomer && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ fontWeight: 600 }}>Selected: {selectedCustomer.name}</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Code: {selectedCustomer.customer_code} | Mobile: {selectedCustomer.mobile || 'N/A'} | Terms: {selectedCustomer.payment_type}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Outstanding Due</span>
              <p style={{ fontWeight: 700, color: 'var(--danger-text)', fontSize: '1.1rem' }}>₹{parseFloat(selectedCustomer.current_balance).toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>

      {/* QUICK MODE TAB VIEW */}
      {saleMode === 'quick' && (
        <form onSubmit={handleSaveQuickSale} className="glass-panel" style={{ maxWidth: '480px', margin: '0 auto', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, textAlign: 'center', marginBottom: '1.5rem' }}>Quick Cash Transaction</h2>
          
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ fontSize: '1rem' }}>Total Bill Amount (कुल बिल राशि) *</label>
            <input 
              type="number" 
              step="0.01" 
              className="input-field" 
              style={{ fontSize: '1.5rem', padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}
              placeholder="₹ 0.00"
              required
              value={quickTotal} 
              onChange={e => setQuickTotal(e.target.value)} 
            />
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label">Payment Mode (भुगतान)</label>
            <select className="input-field" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="Cash">Cash (नकद)</option>
              <option value="UPI">UPI (GPay / Paytm)</option>
              <option value="Card">Card</option>
            </select>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', background: 'var(--success)' }}
          >
            Confirm Cash Sale
          </button>
        </form>
      )}

      {/* DETAILED MODE TAB VIEW */}
      {saleMode === 'detailed' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          
          {/* Detailed Picker and Cart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel">
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Add Product Items</h2>
              <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Search by product name, category or brand..."
                  style={{ paddingLeft: '2.5rem' }}
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value);
                    setShowProdDropdown(true);
                  }}
                  onFocus={() => setShowProdDropdown(true)}
                />

                {showProdDropdown && productSearch && (
                  <div className="glass-panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '0.25rem', padding: '0.5rem', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
                    {products.length === 0 ? (
                      <p style={{ padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No products found.</p>
                    ) : (
                      products.map(p => (
                        <div 
                          key={p.id} 
                          style={{ padding: '0.625rem 0.875rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          className="hover-card"
                          onClick={() => handleAddProductToCart(p)}
                        >
                          <div>
                            <strong style={{ fontSize: '0.95rem' }}>{p.name}</strong> 
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({p.brand || 'No Brand'})</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>₹{parseFloat(p.selling_price).toFixed(2)}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>/{p.unit}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Cart Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.5rem 0' }}>Item Name</th>
                    <th style={{ padding: '0.5rem 0', width: '120px' }}>Rate (₹)</th>
                    <th style={{ padding: '0.5rem 0', width: '100px' }}>Qty</th>
                    <th style={{ padding: '0.5rem 0', width: '120px', textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ padding: '0.5rem 0', width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cart is empty. Search products above to add items.</td>
                    </tr>
                  ) : (
                    cart.map(item => (
                      <tr key={item.product_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{item.name}</td>
                        <td style={{ padding: '0.75rem 0' }}>
                          <input 
                            type="number" 
                            step="0.01" 
                            className="input-field" 
                            style={{ width: '100px', padding: '0.4rem' }} 
                            value={item.price} 
                            onChange={e => handleUpdatePrice(item.product_id, e.target.value)} 
                          />
                        </td>
                        <td style={{ padding: '0.75rem 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <input 
                              type="number" 
                              step="0.1" 
                              className="input-field" 
                              style={{ width: '70px', padding: '0.4rem' }} 
                              value={item.quantity} 
                              onChange={e => handleUpdateQuantity(item.product_id, e.target.value)} 
                            />
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.unit}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 600 }}>
                          ₹{(parseFloat(item.price) * parseFloat(item.quantity)).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>
                          <button type="button" className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)', padding: '0.4rem' }} onClick={() => handleRemoveItem(item.product_id)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Summary Side Panel */}
          <div className="glass-panel" style={{ height: 'fit-content' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Summary</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="flex-between">
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>₹{subtotal.toFixed(2)}</span>
              </div>

              <div className="form-group">
                <label className="form-label">Discount (₹)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input-field" 
                  value={discount} 
                  onChange={e => setDiscount(e.target.value)} 
                />
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

              <div className="flex-between" style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                <span>Total Bill</span>
                <span style={{ color: 'var(--primary)' }}>₹{total.toFixed(2)}</span>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

              <div className="form-group">
                <label className="form-label">Paid Amount (₹)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input-field" 
                  value={paidAmount} 
                  onChange={e => setPaidAmount(e.target.value)} 
                />
                <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setPaidAmount(total.toFixed(2))}>Full Cash</button>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setPaidAmount('0.00')}>Credit Full</button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="input-field" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="Cash">Cash (नकद)</option>
                  <option value="UPI">UPI (GPay/PhonePe)</option>
                  <option value="Card">Card</option>
                  <option value="Credit">Credit (उधार खाता)</option>
                </select>
              </div>

              <div className="flex-between" style={{ fontWeight: 600, color: dueAmount > 0 ? 'var(--danger-text)' : 'inherit' }}>
                <span>Remaining Due</span>
                <span>₹{dueAmount.toFixed(2)}</span>
              </div>
            </div>

            <button 
              type="button" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
              onClick={handleSaveDetailedSale}
            >
              Confirm & Save Sale
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewSale;
