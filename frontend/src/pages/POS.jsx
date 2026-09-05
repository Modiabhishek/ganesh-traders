import React, { useState, useEffect, useRef } from 'react';
import { productAPI, customerAPI, transactionAPI } from '../services/api';
import { 
  ArrowLeft, Search, Barcode, ShoppingCart, Trash2, Plus, Minus, 
  Printer, CheckCircle2, AlertCircle, X, CreditCard, Banknote, 
  QrCode, User, RefreshCw, Volume2, VolumeX, Sparkles, History,
  FileText, ExternalLink
} from 'lucide-react';

const POS = ({ setCurrentPage, goBack }) => {
  // Products & Categories state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Barcode & Scanner state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const scanInputRef = useRef(null);

  // Cart state
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState('0');
  const [discountType, setDiscountType] = useState('amount'); // 'amount' or 'percent'

  // Customer state
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null); // null = Walk-in Customer
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Payment state
  const [paymentMode, setPaymentMode] = useState('Cash'); // 'Cash', 'UPI', 'Credit'
  const [tenderAmount, setTenderAmount] = useState('');
  const [showUpiModal, setShowUpiModal] = useState(false);

  // Completed sale & Receipt state
  const [completedSale, setCompletedSale] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState({ text: '', type: '' });

  // Transactions & Sales Integration state
  const [recentSales, setRecentSales] = useState([]);
  const [showRecentSalesModal, setShowRecentSalesModal] = useState(false);

  // Web Audio API beep
  const playAudio = (type = 'beep') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'beep') {
        osc.frequency.setValueAtTime(950, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'error') {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {
      // Audio autoplay policy, ignore
    }
  };

  // Load catalog, customers & sales transactions
  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, prods, custs, sales] = await Promise.all([
        productAPI.getCategories(),
        productAPI.getProducts(),
        customerAPI.getCustomers(),
        transactionAPI.getSales()
      ]);
      setCategories(cats || []);
      setProducts(prods || []);
      setCustomers(custs || []);
      setRecentSales(sales || []);
    } catch (err) {
      console.error('POS failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshSalesAndStock = async () => {
    try {
      const [prods, custs, sales] = await Promise.all([
        productAPI.getProducts(),
        customerAPI.getCustomers(),
        transactionAPI.getSales()
      ]);
      setProducts(prods || []);
      setCustomers(custs || []);
      setRecentSales(sales || []);
    } catch (e) {
      console.error('Failed to refresh stock & sales:', e);
    }
  };

  const handleReprintFromHistory = (sale) => {
    const saleReceipt = {
      id: sale.id,
      invoice_number: sale.sale_number,
      created_at: sale.sale_date,
      customer_name: sale.customer_name || (sale.customer_id ? `Customer #${sale.customer_id}` : 'Walk-in Customer (नकद ग्राहक)'),
      customer_mobile: null,
      items: (sale.items || []).map(it => ({
        product_id: it.product_id,
        name: it.product_name || `Item #${it.product_id}`,
        quantity: parseFloat(it.quantity),
        price: parseFloat(it.price),
        unit: it.unit || 'unit'
      })),
      subtotal: parseFloat(sale.subtotal) || parseFloat(sale.total_amount),
      discount: parseFloat(sale.discount) || 0,
      grand_total: parseFloat(sale.total_amount),
      payment_mode: sale.payment_method,
      tender_amount: parseFloat(sale.paid_amount) || parseFloat(sale.total_amount),
      change_due: 0
    };
    setCompletedSale(saleReceipt);
    setShowReceiptModal(true);
  };

  // Compute today's sales and revenues
  const todayStr = new Date().toDateString();
  const todaySales = recentSales.filter(s => {
    try {
      const dateStr = s.sale_date;
      const d = dateStr ? (dateStr.includes('Z') || dateStr.includes('+') ? new Date(dateStr) : new Date(dateStr + 'Z')) : new Date();
      return s.status === 'Active' && d.toDateString() === todayStr;
    } catch (e) {
      return false;
    }
  });

  const todayTotalRevenue = todaySales.reduce((acc, s) => acc + (parseFloat(s.total_amount) || 0), 0);
  const todayCashRevenue = todaySales.filter(s => s.payment_method === 'Cash').reduce((acc, s) => acc + (parseFloat(s.paid_amount) || 0), 0);
  const todayUpiRevenue = todaySales.filter(s => s.payment_method === 'UPI').reduce((acc, s) => acc + (parseFloat(s.paid_amount) || 0), 0);

  // Keep scanner input focused
  useEffect(() => {
    if (scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, []);

  // Filter products for touch grid
  const filteredProducts = products.filter(p => {
    const matchesCat = !selectedCategory || p.category_id === parseInt(selectedCategory);
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.product_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // Add item to cart
  const addToCart = (product, qtyToAdd = 1) => {
    setCart(prevCart => {
      const existingIdx = prevCart.findIndex(item => item.product_id === product.id);
      if (existingIdx >= 0) {
        const updated = [...prevCart];
        updated[existingIdx].quantity += qtyToAdd;
        return updated;
      } else {
        return [...prevCart, {
          product_id: product.id,
          product_code: product.product_code,
          barcode: product.barcode || product.product_code,
          name: product.name,
          unit: product.unit,
          pack_size: product.pack_size,
          price: parseFloat(product.selling_price || 0),
          quantity: qtyToAdd
        }];
      }
    });
    playAudio('beep');
    if (scanInputRef.current) {
      scanInputRef.current.focus();
    }
  };

  // Barcode Scanner submission handler
  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    // 1. Search in local product list
    const foundLocal = products.find(p => 
      (p.barcode && p.barcode.toLowerCase() === code.toLowerCase()) ||
      (p.product_code && p.product_code.toLowerCase() === code.toLowerCase())
    );

    if (foundLocal) {
      addToCart(foundLocal, 1);
      setBarcodeInput('');
      return;
    }

    // 2. Try looking up in backend
    try {
      const foundRemote = await productAPI.lookupBarcode(code);
      if (foundRemote) {
        if (!products.some(p => p.id === foundRemote.id)) {
          setProducts(prev => [...prev, foundRemote]);
        }
        addToCart(foundRemote, 1);
        setBarcodeInput('');
        return;
      }
    } catch (err) {
      // 3. Fallback: match by partial name if typed manually
      const nameMatch = products.find(p => p.name.toLowerCase().includes(code.toLowerCase()));
      if (nameMatch) {
        addToCart(nameMatch, 1);
        setBarcodeInput('');
        return;
      }

      playAudio('error');
      setToastMessage({ text: `Product not found with barcode / SKU: "${code}"`, type: 'danger' });
      setTimeout(() => setToastMessage({ text: '', type: '' }), 3000);
    }
  };

  // Cart operations
  const updateQuantity = (productId, newQty) => {
    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty <= 0) {
      setCart(cart.filter(i => i.product_id !== productId));
    } else {
      setCart(cart.map(i => i.product_id === productId ? { ...i, quantity: qty } : i));
    }
  };

  const updatePrice = (productId, newPrice) => {
    const price = parseFloat(newPrice);
    if (!isNaN(price) && price >= 0) {
      setCart(cart.map(i => i.product_id === productId ? { ...i, price: price } : i));
    }
  };

  const removeItem = (productId) => {
    setCart(cart.filter(i => i.product_id !== productId));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Clear current cart?')) {
      setCart([]);
      setDiscount('0');
      setTenderAmount('');
      setSelectedCustomer(null);
    }
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountVal = parseFloat(discount) || 0;
  const discountAmount = discountType === 'percent' ? (subtotal * discountVal) / 100 : discountVal;
  const grandTotal = Math.max(0, subtotal - discountAmount);
  
  const tenderVal = parseFloat(tenderAmount) || 0;
  const changeDue = Math.max(0, tenderVal - grandTotal);

  // Quick tender helpers
  const handleQuickTender = (amount) => {
    if (amount === 'exact') {
      setTenderAmount(grandTotal.toFixed(2));
    } else {
      setTenderAmount(amount.toString());
    }
  };

  // Checkout submission
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Add items to checkout.');
      return;
    }

    if (paymentMode === 'Credit' && !selectedCustomer) {
      alert('Please select a registered Customer for Credit / Khata (उधार) sale.');
      return;
    }

    setSubmitting(true);
    try {
      const itemsPayload = cart.map(item => ({
        product_id: item.product_id,
        quantity: parseFloat(item.quantity),
        price: parseFloat(item.price),
        unit_price: parseFloat(item.price)
      }));

      const paidVal = paymentMode === 'Credit' ? 0.00 : (tenderVal > 0 ? Math.min(tenderVal, grandTotal) : grandTotal);

      const saleData = {
        customer_id: selectedCustomer ? selectedCustomer.id : null,
        items: itemsPayload,
        discount: discountAmount,
        paid_amount: paidVal,
        payment_method: paymentMode,
        payment_mode: paymentMode,
        notes: `POS Terminal Sale ${selectedCustomer ? `(${selectedCustomer.name})` : '(Walk-in)'}`
      };

      const result = await transactionAPI.createSale(saleData);
      
      playAudio('success');

      // Prepare completed sale object for printable receipt
      const saleReceipt = {
        id: result.id,
        invoice_number: result.sale_number || `SALE-${result.id || Date.now().toString().slice(-6)}`,
        created_at: result.sale_date || new Date().toISOString(),
        customer_name: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer (नकद ग्राहक)',
        customer_mobile: selectedCustomer ? selectedCustomer.mobile : null,
        items: [...cart],
        subtotal: subtotal,
        discount: discountAmount,
        grand_total: grandTotal,
        payment_mode: paymentMode,
        tender_amount: tenderVal > 0 ? tenderVal : grandTotal,
        change_due: changeDue
      };

      setCompletedSale(saleReceipt);
      setShowReceiptModal(true);

      // Reset cart
      setCart([]);
      setDiscount('0');
      setTenderAmount('');
      setSelectedCustomer(null);
      setBarcodeInput('');
      if (scanInputRef.current) {
        scanInputRef.current.focus();
      }

      // Automatically refresh transactions and stock
      refreshSalesAndStock();
    } catch (err) {
      console.error('Checkout failed:', err);
      playAudio('error');
      alert(err.response?.data?.detail || 'Failed to complete transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pos-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 1.5rem)', overflow: 'hidden' }}>
      
      {/* Top POS Header Bar */}
      <header className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.5rem', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={goBack} style={{ padding: '0.4rem 0.75rem' }}>
            <ArrowLeft size={16} /> Exit POS
          </button>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingCart size={20} /> POS Billing — गणेश ट्रेडर्स
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>High-Speed Retail Counter Checkout</span>
          </div>
        </div>

        {/* Barcode Scanner Bar */}
        <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, maxWidth: '480px', margin: '0 1.5rem' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Barcode size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />
            <input 
              ref={scanInputRef}
              type="text" 
              className="input-field" 
              placeholder="Scan Barcode or Type SKU / Name (Enter)..." 
              value={barcodeInput} 
              onChange={e => setBarcodeInput(e.target.value)}
              style={{ paddingLeft: '2.5rem', borderColor: 'var(--primary)', boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.25)', fontWeight: 600 }}
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}>
            Add
          </button>
        </form>

        {/* Audio Toggle & Quick Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={() => setShowRecentSalesModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.4rem 0.75rem', fontWeight: 600, borderColor: 'rgba(59, 130, 246, 0.4)', background: 'rgba(59, 130, 246, 0.08)' }}
            title="View today's sales transactions and reprint receipts"
          >
            <History size={16} color="var(--primary)" />
            <span>Today's Bills: <strong style={{ color: 'var(--primary)' }}>{todaySales.length}</strong> (₹{todayTotalRevenue.toFixed(0)})</span>
          </button>

          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Beep Sound Enabled' : 'Sound Muted'}
            style={{ padding: '0.5rem' }}
          >
            {soundEnabled ? <Volume2 size={18} color="#10b981" /> : <VolumeX size={18} color="var(--text-muted)" />}
          </button>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, background: 'var(--bg-primary)', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            Cart: <span style={{ color: 'var(--primary)' }}>{cart.length} Items</span>
          </div>
        </div>
      </header>

      {/* Toast Alert */}
      {toastMessage.text && (
        <div style={{ position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 10001, background: '#ef4444', color: '#ffffff', padding: '0.65rem 1.5rem', borderRadius: '8px', fontWeight: 600, boxShadow: '0 8px 20px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} /> {toastMessage.text}
        </div>
      )}

      {/* Main POS Split Screen */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT SECTION (65%): Touch Product Grid & Categories */}
        <div style={{ flex: 6.5, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', background: 'var(--bg-primary)', overflow: 'hidden' }}>
          
          {/* Category Chips Bar */}
          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', overflowX: 'auto', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', whiteSpace: 'nowrap' }}>
            <button 
              type="button" 
              className={`btn ${!selectedCategory ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.825rem', borderRadius: '20px' }}
              onClick={() => setSelectedCategory('')}
            >
              All Items ({products.length})
            </button>
            {categories.map(cat => (
              <button 
                key={cat.id}
                type="button" 
                className={`btn ${selectedCategory === cat.id.toString() ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.35rem 0.85rem', fontSize: '0.825rem', borderRadius: '20px' }}
                onClick={() => setSelectedCategory(cat.id.toString())}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Search Filter input */}
          <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={16} color="var(--text-muted)" />
            <input 
              type="text" 
              className="input-field" 
              placeholder="Quick search products by name / SKU..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
            />
            {searchQuery && (
              <button className="btn btn-secondary" onClick={() => setSearchQuery('')} style={{ padding: '0.25rem 0.5rem' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Product Cards Grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', alignContent: 'start' }}>
            {filteredProducts.map(prod => {
              const inCart = cart.find(i => i.product_id === prod.id);
              return (
                <div 
                  key={prod.id} 
                  className="glass-panel"
                  onClick={() => addToCart(prod, 1)}
                  style={{ 
                    cursor: 'pointer', 
                    padding: '0.85rem', 
                    borderRadius: '10px', 
                    border: inCart ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: inCart ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-secondary)',
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between',
                    position: 'relative',
                    transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                    minHeight: '120px'
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {inCart && (
                    <span style={{ position: 'absolute', top: '6px', right: '6px', background: 'var(--primary)', color: '#000', fontWeight: 800, fontSize: '0.7rem', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {inCart.quantity}
                    </span>
                  )}
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', lineHeight: '1.2' }}>
                      {prod.name}
                    </div>
                    {prod.pack_size && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {prod.pack_size}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>
                      ₹{parseFloat(prod.selling_price || 0).toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {prod.unit}
                    </span>
                  </div>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No items found matching filter.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SECTION (35%): Live Cart & Checkout */}
        <div style={{ flex: 3.5, display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
          
          {/* Customer Header Selector */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={16} color="var(--primary)" />
                <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                  {selectedCustomer ? selectedCustomer.name : 'Walk-in Customer (नकद ग्राहक)'}
                </span>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
              >
                {selectedCustomer ? 'Change' : 'Select Khata'}
              </button>
            </div>
            {selectedCustomer && (
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>Mobile: {selectedCustomer.mobile || 'N/A'}</span>
                <span style={{ color: selectedCustomer.current_balance > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                  Dues: ₹{parseFloat(selectedCustomer.current_balance || 0).toFixed(2)}
                </span>
              </div>
            )}

            {/* Customer Dropdown */}
            {showCustomerDropdown && (
              <div className="glass-panel" style={{ position: 'absolute', top: '100%', left: '1rem', right: '1rem', zIndex: 100, padding: '0.75rem', marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', maxHeight: '240px', overflowY: 'auto' }}>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Search customer by name or phone..." 
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}
                  autoFocus
                />
                <div 
                  style={{ padding: '0.4rem 0.5rem', cursor: 'pointer', borderRadius: '4px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--primary)' }}
                  onClick={() => { setSelectedCustomer(null); setShowCustomerDropdown(false); }}
                >
                  ✓ Walk-in Customer (Default)
                </div>
                {customers
                  .filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.mobile && c.mobile.includes(customerSearch)))
                  .slice(0, 10)
                  .map(c => (
                    <div 
                      key={c.id} 
                      style={{ padding: '0.4rem 0.5rem', cursor: 'pointer', borderRadius: '4px', fontSize: '0.825rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}
                      onClick={() => { setSelectedCustomer(c); setShowCustomerDropdown(false); }}
                    >
                      <span>{c.name} ({c.mobile || 'No Mobile'})</span>
                      <span style={{ fontWeight: 600, color: c.current_balance > 0 ? '#ef4444' : '#10b981' }}>
                        ₹{parseFloat(c.current_balance || 0).toFixed(0)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Cart Table Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr 28px', gap: '0.25rem', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
            <div>Item</div>
            <div style={{ textAlign: 'center' }}>Price</div>
            <div style={{ textAlign: 'center' }}>Qty</div>
            <div style={{ textAlign: 'right' }}>Total</div>
            <div></div>
          </div>

          {/* Cart Items List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1rem' }}>
            {cart.map(item => (
              <div 
                key={item.product_id} 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '2fr 1fr 1.2fr 1fr 28px', 
                  gap: '0.25rem', 
                  alignItems: 'center', 
                  padding: '0.45rem 0', 
                  borderBottom: '1px dashed var(--border-color)',
                  fontSize: '0.85rem'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{item.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{item.barcode}</div>
                </div>

                {/* Price input */}
                <input 
                  type="number" 
                  step="0.5" 
                  className="input-field" 
                  style={{ padding: '0.2rem', textAlign: 'center', fontSize: '0.8rem' }}
                  value={item.price}
                  onChange={e => updatePrice(item.product_id, e.target.value)}
                />

                {/* Quantity Stepper */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: '0.15rem 0.35rem', borderRadius: '4px' }}
                    onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                  >
                    <Minus size={12} />
                  </button>
                  <input 
                    type="number" 
                    step="0.1" 
                    className="input-field" 
                    style={{ width: '38px', padding: '0.2rem', textAlign: 'center', fontSize: '0.8rem' }}
                    value={item.quantity}
                    onChange={e => updateQuantity(item.product_id, e.target.value)}
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: '0.15rem 0.35rem', borderRadius: '4px' }}
                    onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* Line Total */}
                <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ₹{(item.price * item.quantity).toFixed(2)}
                </div>

                {/* Remove button */}
                <button 
                  type="button" 
                  onClick={() => removeItem(item.product_id)} 
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {cart.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                <Barcode size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p style={{ margin: 0, fontSize: '0.875rem' }}>Scan barcode or click items to add to bill.</p>
              </div>
            )}
          </div>

          {/* Cart Calculation Summary */}
          <div style={{ padding: '0.85rem 1rem', background: 'var(--bg-primary)', borderTop: '2px solid var(--border-color)' }}>
            
            {/* Subtotal & Discount row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal ({cart.length} items):</span>
              <span style={{ fontWeight: 600 }}>₹{subtotal.toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Discount:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  type="number" 
                  className="input-field" 
                  style={{ width: '64px', padding: '0.2rem 0.4rem', textAlign: 'right', fontSize: '0.8rem' }}
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                />
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                  onClick={() => setDiscountType(discountType === 'amount' ? 'percent' : 'amount')}
                >
                  {discountType === 'amount' ? '₹' : '%'}
                </button>
              </div>
            </div>

            {/* GRAND TOTAL ROW */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.5rem 0', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', margin: '0.5rem 0' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>GRAND TOTAL:</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                ₹{grandTotal.toFixed(2)}
              </span>
            </div>

            {/* Payment Mode Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.35rem', margin: '0.65rem 0' }}>
              <button 
                type="button" 
                className={`btn ${paymentMode === 'Cash' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.4rem', fontSize: '0.8rem', justifyContent: 'center' }}
                onClick={() => setPaymentMode('Cash')}
              >
                <Banknote size={14} /> Cash
              </button>
              <button 
                type="button" 
                className={`btn ${paymentMode === 'UPI' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.4rem', fontSize: '0.8rem', justifyContent: 'center' }}
                onClick={() => { setPaymentMode('UPI'); setShowUpiModal(true); }}
              >
                <QrCode size={14} /> UPI / QR
              </button>
              <button 
                type="button" 
                className={`btn ${paymentMode === 'Credit' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.4rem', fontSize: '0.8rem', justifyContent: 'center' }}
                onClick={() => setPaymentMode('Credit')}
              >
                <CreditCard size={14} /> Khata
              </button>
            </div>

            {/* Tender & Change Return (for Cash mode) */}
            {paymentMode === 'Cash' && (
              <div style={{ background: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Tender Cash:</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }} onClick={() => handleQuickTender('exact')}>Exact</button>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }} onClick={() => handleQuickTender(100)}>₹100</button>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }} onClick={() => handleQuickTender(200)}>₹200</button>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }} onClick={() => handleQuickTender(500)}>₹500</button>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }} onClick={() => handleQuickTender(2000)}>₹2000</button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="Customer Paid ₹" 
                    value={tenderAmount}
                    onChange={e => setTenderAmount(e.target.value)}
                    style={{ width: '130px', padding: '0.3rem 0.5rem', fontSize: '0.85rem', fontWeight: 700 }}
                  />
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Change Return:</span>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: changeDue > 0 ? '#10b981' : 'var(--text-primary)' }}>
                      ₹{changeDue.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '0.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary"
                style={{ padding: '0.75rem', justifyContent: 'center', color: 'var(--danger-text)' }}
                onClick={clearCart}
                disabled={cart.length === 0}
              >
                Clear
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                style={{ padding: '0.75rem', justifyContent: 'center', fontWeight: 800, fontSize: '1.05rem', background: '#10b981', borderColor: '#059669', color: '#fff', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}
                onClick={handleCheckout}
                disabled={cart.length === 0 || submitting}
              >
                {submitting ? 'Billing...' : `Complete & Print (₹${grandTotal.toFixed(0)})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* UPI QR Code Modal */}
      {showUpiModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ background: 'var(--bg-primary)', padding: '2rem', borderRadius: '16px', maxWidth: '380px', width: '100%', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 800 }}>Scan & Pay via UPI</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Ganesh Traders (PhonePe / GPay / Paytm)</p>
            <div style={{ marginTop: '0.5rem', display: 'inline-block', background: 'rgba(59, 130, 246, 0.1)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700 }}>
              UPI ID: <code style={{ letterSpacing: '0.5px' }}>7023062391-2@ybl</code>
            </div>
            
            <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '12px', margin: '1.25rem auto', display: 'inline-block', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=7023062391-2@ybl&pn=Ganesh%20Traders&am=${grandTotal.toFixed(2)}&cu=INR`)}`}
                alt="UPI QR Code" 
                style={{ width: '180px', height: '180px', display: 'block' }}
              />
            </div>

            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '1rem' }}>
              Amount: ₹{grandTotal.toFixed(2)}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowUpiModal(false)}>Close</button>
              <button 
                className="btn btn-primary" 
                style={{ background: '#10b981', borderColor: '#059669' }}
                onClick={() => {
                  setShowUpiModal(false);
                  setPaymentMode('UPI');
                }}
              >
                Payment Received
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Thermal Receipt Modal */}
      {showReceiptModal && completedSale && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ background: 'var(--bg-primary)', borderRadius: '16px', maxWidth: '420px', width: '100%', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
            
            <div className="no-print" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={18} /> Sale Completed!
              </span>
              <button className="btn btn-secondary" onClick={() => setShowReceiptModal(false)} style={{ padding: '0.25rem 0.5rem' }}>
                <X size={16} />
              </button>
            </div>

            {/* Receipt Printable Preview Box */}
            <div id="pos-thermal-receipt" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: '#ffffff', color: '#000000', fontFamily: 'monospace', fontSize: '12px' }}>
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>GANESH TRADERS</div>
                <div style={{ fontSize: '11px' }}>।। श्री गणेशाय नमः ।।</div>
                <div style={{ fontSize: '11px' }}>Kirana, General & Crop Merchant</div>
                <div style={{ fontSize: '10px', marginTop: '4px' }}>Date: {new Date(completedSale.created_at).toLocaleDateString()} {new Date(completedSale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div style={{ fontSize: '10px' }}>Invoice: {completedSale.invoice_number}</div>
                <div style={{ fontSize: '10px' }}>Customer: {completedSale.customer_name}</div>
              </div>

              <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '6px 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', fontWeight: 'bold' }}>
                  <div>Item</div>
                  <div style={{ textAlign: 'center' }}>Qty</div>
                  <div style={{ textAlign: 'right' }}>Total</div>
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                {completedSale.items.map((it, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', margin: '3px 0' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                    <div style={{ textAlign: 'center' }}>{it.quantity} {it.unit}</div>
                    <div style={{ textAlign: 'right' }}>₹{(it.price * it.quantity).toFixed(2)}</div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px dashed #000', paddingTop: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>₹{completedSale.subtotal.toFixed(2)}</span>
                </div>
                {completedSale.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Discount:</span>
                    <span>-₹{completedSale.discount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', margin: '4px 0' }}>
                  <span>TOTAL:</span>
                  <span>₹{completedSale.grand_total.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>Paid ({completedSale.payment_mode}):</span>
                  <span>₹{completedSale.tender_amount.toFixed(2)}</span>
                </div>
                {completedSale.change_due > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
                    <span>Change Return:</span>
                    <span>₹{completedSale.change_due.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px', borderTop: '1px dashed #000', paddingTop: '8px', fontSize: '11px' }}>
                <div>* Thank You! Please Visit Again *</div>
                <div style={{ fontSize: '9px', marginTop: '2px', fontWeight: 'bold' }}>UPI: 7023062391-2@ybl</div>
                <div style={{ fontSize: '9px', marginTop: '2px' }}>Ganesh Traders Billing System</div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="no-print" style={{ padding: '1rem', background: 'var(--bg-secondary)', display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                onClick={() => setShowReceiptModal(false)}
              >
                Next Customer
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ flex: 1, background: '#3b82f6', borderColor: '#2563eb' }}
                onClick={() => window.print()}
              >
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent POS Sales & Transaction History Drawer Modal */}
      {showRecentSalesModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ background: 'var(--bg-primary)', borderRadius: '16px', maxWidth: '820px', width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <History size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>POS Transactions & Today's Sales</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Live sales audit, collections & receipt reprints</span>
                </div>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowRecentSalesModal(false)} style={{ padding: '0.35rem', borderRadius: '50%' }}>
                <X size={18} />
              </button>
            </div>

            {/* Daily Metrics Row */}
            <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-secondary)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Sales Today</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>₹{todayTotalRevenue.toFixed(2)}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cash In Drawer</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>₹{todayCashRevenue.toFixed(2)}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>UPI Collections</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3b82f6' }}>₹{todayUpiRevenue.toFixed(2)}</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Bills</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{todaySales.length}</div>
              </div>
            </div>

            {/* Sales Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
              {recentSales.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No transactions recorded yet. Complete a sale at the POS counter to see it here.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.5rem' }}>Invoice #</th>
                      <th style={{ padding: '0.5rem' }}>Date & Time</th>
                      <th style={{ padding: '0.5rem' }}>Customer</th>
                      <th style={{ padding: '0.5rem' }}>Items</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center' }}>Mode</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSales.slice(0, 30).map((sale) => {
                      const d = sale.sale_date ? (sale.sale_date.includes('Z') || sale.sale_date.includes('+') ? new Date(sale.sale_date) : new Date(sale.sale_date + 'Z')) : new Date();
                      const saleTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const saleDate = d.toLocaleDateString([], { day: '2-digit', month: 'short' });
                      return (
                        <tr key={sale.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.65rem 0.5rem', fontWeight: 700 }}>
                            <code style={{ color: 'var(--primary)' }}>{sale.sale_number}</code>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {saleDate} {saleTime}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem' }}>
                            <div style={{ fontWeight: 600 }}>{sale.customer_name || 'Walk-in'}</div>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {sale.items ? `${sale.items.length} items` : '-'}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontWeight: 700 }}>
                            ₹{parseFloat(sale.total_amount).toFixed(2)}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                            <span style={{ 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              fontSize: '0.75rem', 
                              fontWeight: 600,
                              background: sale.payment_method === 'Cash' ? 'rgba(16, 185, 129, 0.15)' : (sale.payment_method === 'UPI' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                              color: sale.payment_method === 'Cash' ? '#10b981' : (sale.payment_method === 'UPI' ? '#3b82f6' : '#ef4444')
                            }}>
                              {sale.payment_method}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => {
                                handleReprintFromHistory(sale);
                                setShowRecentSalesModal(false);
                              }}
                              title="Reprint Receipt"
                            >
                              <Printer size={13} /> Reprint
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '0.85rem 1.5rem', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Showing latest {Math.min(recentSales.length, 30)} transactions</span>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowRecentSalesModal(false);
                    if (setCurrentPage) setCurrentPage('transactions');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                >
                  <ExternalLink size={14} /> Full Transaction History
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => setShowRecentSalesModal(false)}
                  style={{ fontSize: '0.85rem' }}
                >
                  Back to POS
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* POS Print CSS for 58mm/80mm thermal slip */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #pos-thermal-receipt, #pos-thermal-receipt * {
            visibility: visible !important;
          }
          #pos-thermal-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 76mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            background: #fff !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default POS;
