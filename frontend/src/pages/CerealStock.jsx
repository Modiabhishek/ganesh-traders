import React, { useState, useEffect } from 'react';
import { productAPI, cerealAPI } from '../services/api';
import { Search, Edit3, Trash2, Loader, CheckCircle, ArrowLeft, Printer, RefreshCw, PlusCircle, TrendingUp, TrendingDown, ClipboardList } from 'lucide-react';
import { parseISTDate, formatISTDateTime } from '../utils/dateUtils';

const CerealStock = ({ setCurrentPage, goBack }) => {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cerealCategoryId, setCerealCategoryId] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stock'); // 'stock', 'profit', 'logs'
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  // Modals
  const [showTxModal, setShowTxModal] = useState(false); // Buy/Sell modal
  const [txType, setTxType] = useState('BUY'); // 'BUY' or 'SELL'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [txWeight, setTxWeight] = useState('');
  const [txUnit, setTxUnit] = useState('quintal'); // 'quintal' or 'kg'
  const [txRate, setTxRate] = useState('');
  const [txBags, setTxBags] = useState('');
  const [txNotes, setTxNotes] = useState('');
  const [editingTx, setEditingTx] = useState(null);

  // Crop Add/Modify Modal
  const [showCropModal, setShowCropModal] = useState(false);
  const [editingCrop, setEditingCrop] = useState(null);
  const [cropName, setCropName] = useState('');
  const [cropUnit, setCropUnit] = useState('quintal'); // 'quintal' or 'kg'
  const [cropMinStock, setCropMinStock] = useState('10.00');
  const [cropNotes, setCropNotes] = useState('');

  // Load Categories, Products and Cereal Transactions
  const loadAllCerealData = async () => {
    setLoading(true);
    try {
      const cats = await productAPI.getCategories();
      setCategories(cats);
      let catId = cats.find(c => c.name === 'Cereals & Crops')?.id;
      
      // If Cereals & Crops category is missing, create it dynamically
      if (!catId) {
        try {
          const newCat = await productAPI.createCategory({ name: 'Cereals & Crops' });
          catId = newCat.id;
          // Refresh category list
          const updatedCats = await productAPI.getCategories();
          setCategories(updatedCats);
        } catch (e) {
          console.error("Error creating category:", e);
        }
      }
      
      setCerealCategoryId(catId);

      // Load products under Cereal category
      const prods = await productAPI.getProducts('', catId);
      setProducts(prods);

      // Load cereal transactions
      const txs = await cerealAPI.getTransactions();
      setTransactions(txs);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to load cereal data from backend.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllCerealData();
  }, []);

  // Handle Add/Modify Crop Submit
  const handleCropSubmit = async (e) => {
    e.preventDefault();
    if (!cropName.trim()) return;

    const payload = {
      name: cropName.trim(),
      category_id: cerealCategoryId,
      brand: 'Local Crops',
      unit: cropUnit,
      minimum_stock: parseFloat(cropMinStock) || 0.00,
      notes: cropNotes || null
    };

    try {
      if (editingCrop) {
        await productAPI.updateProduct(editingCrop.id, payload);
        setMessage({ text: `Crop "${cropName}" updated successfully!`, type: 'success' });
      } else {
        await productAPI.createProduct(payload);
        setMessage({ text: `New Crop "${cropName}" added to catalog successfully!`, type: 'success' });
      }
      setShowCropModal(false);
      setEditingCrop(null);
      setCropName('');
      setCropNotes('');
      loadAllCerealData();
      
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to save crop details.', type: 'danger' });
    }
  };

  const handleEditCropClick = (crop) => {
    setEditingCrop(crop);
    setCropName(crop.name);
    setCropUnit(crop.unit);
    setCropMinStock(parseFloat(crop.minimum_stock).toString());
    setCropNotes(crop.notes || '');
    setShowCropModal(true);
  };

  const handleDeleteCropClick = async (crop) => {
    if (!window.confirm(`Are you sure you want to remove "${crop.name}" from your crop list?`)) return;
    try {
      await productAPI.deleteProduct(crop.id);
      setMessage({ text: `Crop "${crop.name}" removed successfully.`, type: 'success' });
      loadAllCerealData();
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to remove crop.', type: 'danger' });
    }
  };

  // Handle Buy/Sell Transaction Submit
  const handleTxSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const weightVal = parseFloat(txWeight);
    const rateVal = parseFloat(txRate);
    if (!weightVal || !rateVal) {
      alert("Please enter valid weight and rate.");
      return;
    }

    const payload = {
      product_id: selectedProduct.id,
      transaction_type: txType,
      weight: weightVal,
      unit: txUnit,
      rate: rateVal,
      bags: txBags ? parseInt(txBags, 10) : null,
      notes: txNotes || null
    };

    try {
      if (editingTx) {
        await cerealAPI.updateTransaction(editingTx.id, payload);
        setMessage({ 
          text: `Successfully updated transaction for ${selectedProduct.name}!`, 
          type: 'success' 
        });
      } else {
        await cerealAPI.createTransaction(payload);
        setMessage({ 
          text: `Successfully recorded ${txType === 'BUY' ? 'purchase from farmer' : 'bulk dispatch'} for ${selectedProduct.name}!`, 
          type: 'success' 
        });
      }
      setShowTxModal(false);
      setSelectedProduct(null);
      setEditingTx(null);
      setTxWeight('');
      setTxRate('');
      setTxBags('');
      setTxNotes('');
      loadAllCerealData();
      
      setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to record/update transaction. Check backend connection.', type: 'danger' });
    }
  };

  const handleOpenTx = (product, type) => {
    setSelectedProduct(product);
    setTxType(type);
    setTxUnit(product.unit); // Default transaction unit to product's unit
    setTxRate(type === 'BUY' ? parseFloat(product.purchase_price).toString() : parseFloat(product.selling_price).toString());
    setShowTxModal(true);
  };

  // Convert weight into equivalent bags (assuming 50kg bag)
  const calculateBags = (stockQty, unit) => {
    const qty = parseFloat(stockQty) || 0;
    if (unit === 'quintal') {
      return qty * 2; // 1 quintal = 100 kg = 2 bags of 50kg
    } else if (unit === 'kg') {
      return qty / 50;
    }
    return qty;
  };

  // Calculate Monthly Crop Profit Report
  const getMonthlyCropsReport = () => {
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();

    // Filter transactions to current month
    const currentMonthTxs = transactions.filter(t => {
      const d = parseISTDate(t.created_at);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    return products.map(p => {
      // Find all BUYs and SELLs of this product in this month
      const pTxs = currentMonthTxs.filter(t => t.product_id === p.id);
      
      let totalQtyBought = 0; // standard in product unit
      let totalQtySold = 0; // standard in product unit
      let totalRevenue = 0;
      let totalSpend = 0;

      pTxs.forEach(t => {
        // Convert transaction weight to product standard unit
        let weightAdjusted = parseFloat(t.weight) || 0;
        if (t.unit === 'kg' && p.unit === 'quintal') {
          weightAdjusted = weightAdjusted / 100;
        } else if (t.unit === 'quintal' && p.unit === 'kg') {
          weightAdjusted = weightAdjusted * 100;
        }

        const amount = parseFloat(t.total_amount) || 0;

        if (t.transaction_type === 'BUY') {
          totalQtyBought += weightAdjusted;
          totalSpend += amount;
        } else {
          totalQtySold += weightAdjusted;
          totalRevenue += amount;
        }
      });

      // Calculate cost basis (Average Buy Price this month, falling back to current purchase_price)
      let costBasis = parseFloat(p.purchase_price) || 0;
      if (totalQtyBought > 0) {
        // If product is quintal, totalSpend / totalQtyBought gives rate per quintal.
        // If product is kg, totalSpend / totalQtyBought gives rate per kg.
        costBasis = totalSpend / totalQtyBought;
      }

      // Cost of Goods Sold (COGS)
      const cogs = totalQtySold * costBasis;
      const profit = totalRevenue - cogs;

      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        totalQtyBought,
        totalQtySold,
        totalRevenue,
        cogs,
        profit
      };
    });
  };

  const monthlyReport = getMonthlyCropsReport();
  const totalMonthlyProfit = monthlyReport.reduce((acc, r) => acc + r.profit, 0);

  // Filtered Products for Search
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.product_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="layout-container" style={{ animation: 'fadeIn 0.25s ease' }}>
      <header className="flex-between no-print" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Cereals & Crops Board (अनाज व्यापार)</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Log buying from farmers, bulk dispatches, and track crop-wise profits</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={16} /> Print Report
          </button>
          <button className="btn btn-secondary" onClick={loadAllCerealData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => {
            setEditingCrop(null);
            setCropName('');
            setCropUnit('quintal');
            setCropMinStock('10.00');
            setCropNotes('');
            setShowCropModal(true);
          }}>
            <PlusCircle size={16} /> Add New Crop
          </button>
        </div>
      </header>

      {/* Print Header */}
      <div className="print-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>GANESH TRADERS — CROP BUSINESS LEDGER</h1>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>Live Inventory and Crop Valuation Directory</p>
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

      {/* Navigation Tabs */}
      <section className="no-print" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <button className={`btn ${activeTab === 'stock' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('stock')}>
          <ClipboardList size={16} /> Stock Board (स्टॉक बोर्ड)
        </button>
        <button className={`btn ${activeTab === 'profit' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('profit')}>
          <TrendingUp size={16} /> Monthly Profit (मुनाफा रिपोर्ट)
        </button>
        <button className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('logs')}>
          <Search size={16} /> Transaction Logs (रजिस्टर)
        </button>
      </section>

      {/* -------------------- TAB 1: STOCK BOARD -------------------- */}
      {activeTab === 'stock' && (
        <div>
          {/* Summary valuation card */}
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Crop Stock Valuation</span>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.25rem' }}>
                ₹{products.reduce((acc, p) => acc + ((parseFloat(p.current_stock) || 0) * (parseFloat(p.selling_price) || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>Crops Registered</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.15rem' }}>{products.length}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>Total Bags (Approx)</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.15rem', color: 'var(--success-text)' }}>
                  {products.reduce((acc, p) => acc + calculateBags(p.current_stock, p.unit), 0).toFixed(0)} Bags
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="glass-panel no-print" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="input-field" 
                placeholder="Search crops by name..." 
                style={{ paddingLeft: '2.5rem' }} 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
            </div>
          </div>

          {/* Crops Grid */}
          <section className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '1rem' }}>Code</th>
                  <th style={{ padding: '1rem' }}>Crop Name</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Present Weight</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Approx Bags</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Buying Rate (₹)</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Selling Rate (₹)</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Stock Value</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }} className="no-print">Quick Trade</th>
                  <th style={{ padding: '1rem', textAlign: 'right', width: '110px' }} className="no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => {
                  const qty = parseFloat(p.current_stock) || 0;
                  const buyRate = parseFloat(p.purchase_price) || 0;
                  const sellRate = parseFloat(p.selling_price) || 0;
                  const value = qty * sellRate;
                  const bags = calculateBags(p.current_stock, p.unit);

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }} className="hover-card">
                      <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.product_code}</td>
                      <td style={{ padding: '1rem' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{p.name}</strong>
                        {p.notes && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.notes}</span>}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                        {qty.toFixed(2)} <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{p.unit}</span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--primary)', fontWeight: 500 }}>
                        {bags.toFixed(0)} bags (बोरी)
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        ₹{buyRate.toFixed(2)}<span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/{p.unit}</span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                        ₹{sellRate.toFixed(2)}<span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/{p.unit}</span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700 }}>
                        ₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }} className="no-print">
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--success-text)', background: 'var(--success-bg)', padding: '0.35rem 0.65rem' }}
                            onClick={() => handleOpenTx(p, 'BUY')}
                          >
                            Buy (खरीद)
                          </button>
                          <button 
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--danger-text)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.35rem 0.65rem' }}
                            onClick={() => handleOpenTx(p, 'SELL')}
                          >
                            Sell (बेच)
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }} className="no-print">
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEditCropClick(p)} title="Modify Crop">
                            <Edit3 size={12} />
                          </button>
                          <button className="btn btn-secondary btn-sm" style={{ color: '#b91c1c' }} onClick={() => handleDeleteCropClick(p)} title="Remove Crop">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* -------------------- TAB 2: MONTHLY PROFIT REPORT -------------------- */}
      {activeTab === 'profit' && (
        <div>
          {/* Summary Profit card */}
          <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Monthly Net Profit from Crop Trading (इस महीने का मुनाफा)</span>
              <h2 style={{ fontSize: '1.85rem', fontWeight: 700, color: totalMonthlyProfit >= 0 ? 'var(--success-text)' : '#b91c1c', marginTop: '0.25rem' }}>
                ₹{totalMonthlyProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h2>
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', textAlign: 'right' }}>Calculation Basis</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', maxWidth: '300px', textAlign: 'right', marginTop: '0.25rem' }}>
                Profit = Revenue from bulk sales - (Quantity sold * Average buying price of this month)
              </span>
            </div>
          </div>

          <section className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '1rem' }}>Crop Name</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Total Weight Bought</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Total Weight Sold</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Monthly Revenue (₹)</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Cost of Goods Sold (₹)</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Net Profit (₹)</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {monthlyReport.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.925rem' }}>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {r.totalQtyBought.toFixed(2)} {r.unit}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      {r.totalQtySold.toFixed(2)} {r.unit}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      ₹{r.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      ₹{r.cogs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: r.profit >= 0 ? 'var(--success-text)' : '#b91c1c' }}>
                      ₹{r.profit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {r.profit > 0 ? (
                        <TrendingUp size={16} style={{ color: 'var(--success-text)', display: 'inline' }} />
                      ) : r.profit < 0 ? (
                        <TrendingDown size={16} style={{ color: '#b91c1c', display: 'inline' }} />
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* -------------------- TAB 3: TRANSACTION LOGS -------------------- */}
      {activeTab === 'logs' && (
        <div>
          <section className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '1rem' }}>Date & Time</th>
                  <th style={{ padding: '1rem' }}>Crop</th>
                  <th style={{ padding: '1rem' }}>Type</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Weight</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Total Amount (₹)</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Bags/Kattas</th>
                  <th style={{ padding: '1rem' }}>Remarks / Farmer / Buyer</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }} className="no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No trade transactions recorded yet.</td>
                  </tr>
                ) : (
                  transactions.map(t => {
                    const prodName = products.find(p => p.id === t.product_id)?.name || 'Unknown Crop';
                    const txDate = formatISTDateTime(t.created_at);
                    
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{txDate}</td>
                        <td style={{ padding: '1rem', fontWeight: 600 }}>{prodName}</td>
                        <td style={{ padding: '1rem' }}>
                          <span className={`badge ${t.transaction_type === 'BUY' ? 'badge-success' : 'badge-info'}`}>
                            {t.transaction_type === 'BUY' ? 'Buy (खरीद)' : 'Sell (बेच)'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                          {parseFloat(t.weight).toFixed(2)} {t.unit}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          ₹{parseFloat(t.rate).toFixed(2)}/{t.unit}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700 }}>
                          ₹{parseFloat(t.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--primary)' }}>
                          {t.bags ? `${t.bags} kattas` : 'N/A'}
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{t.notes || 'No remarks'}</td>
                        <td style={{ padding: '1rem', textAlign: 'center' }} className="no-print">
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              const crop = products.find(p => p.id === t.product_id);
                              if (crop) {
                                setSelectedProduct(crop);
                                setTxType(t.transaction_type);
                                setTxWeight(parseFloat(t.weight).toString());
                                setTxUnit(t.unit);
                                setTxRate(parseFloat(t.rate).toString());
                                setTxBags(t.bags ? t.bags.toString() : '');
                                setTxNotes(t.notes || '');
                                setEditingTx(t);
                                setShowTxModal(true);
                              }
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* -------------------- MODAL: BUY/SELL CEREAL -------------------- */}
      {showTxModal && selectedProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '440px', background: 'var(--bg-secondary)', animation: 'scaleUp 0.2s ease', padding: '2rem' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: txType === 'BUY' ? 'var(--success-text)' : 'var(--primary)' }}>
                {txType === 'BUY' ? 'Buy Crop from Farmer' : 'Sell Crop in Bulk'}
              </h2>
              <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setShowTxModal(false)}>✕</button>
            </div>
            
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1.25rem' }}>Selected: {selectedProduct.name}</h3>

            <form onSubmit={handleTxSubmit}>
              {/* Weight and Unit */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Weight Quantity *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="input-field" 
                    required 
                    placeholder="Enter quantity"
                    style={{ flex: 2 }}
                    value={txWeight} 
                    onChange={e => setTxWeight(e.target.value)} 
                  />
                  <select 
                    className="input-field" 
                    style={{ flex: 1 }}
                    value={txUnit} 
                    onChange={e => setTxUnit(e.target.value)}
                  >
                    <option value="quintal">Quintal</option>
                    <option value="kg">KG</option>
                  </select>
                </div>
              </div>

              {/* Rate */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Rate Price (₹ per {txUnit}) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input-field" 
                  required
                  placeholder={`e.g. ₹ ${txUnit === 'quintal' ? '2400' : '24'}`}
                  value={txRate} 
                  onChange={e => setTxRate(e.target.value)} 
                />
              </div>

              {/* Bags/Kattas (Optional) */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Number of Bags / Kattas (Optional / बोरी संख्या)</label>
                <input 
                  type="number" 
                  className="input-field" 
                  placeholder="e.g. 50"
                  value={txBags} 
                  onChange={e => setTxBags(e.target.value)} 
                />
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">{txType === 'BUY' ? 'Farmer Name / Crop Quality Remarks' : 'Buyer Name / Contract Details'}</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder={txType === 'BUY' ? 'e.g. Ramesh Singh, 12% Moisture' : 'e.g. Adani Mandi, Quality Premium'}
                  value={txNotes} 
                  onChange={e => setTxNotes(e.target.value)} 
                />
              </div>

              {/* Total Calculation Preview */}
              {txWeight && txRate && (
                <div style={{ padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Calculated Bill Amount:</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
                    ₹{(parseFloat(txWeight) * parseFloat(txRate)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTxModal(false)}>Cancel</button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ background: txType === 'BUY' ? 'var(--success)' : 'var(--primary)' }}
                >
                  {txType === 'BUY' ? 'Confirm Purchase' : 'Confirm Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: ADD/MODIFY CROP -------------------- */}
      {showCropModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '440px', background: 'var(--bg-secondary)', animation: 'scaleUp 0.2s ease', padding: '2rem' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{editingCrop ? 'Modify Cereal Crop' : 'Add New Cereal Crop'}</h2>
              <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setShowCropModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCropSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Crop Name *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  required
                  placeholder="e.g. Barley (जौ) / Guar (ग्वार)"
                  value={cropName} 
                  onChange={e => setCropName(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Default Unit of Weight *</label>
                <select className="input-field" value={cropUnit} onChange={e => setCropUnit(e.target.value)}>
                  <option value="quintal">Quintal (क्विंटल)</option>
                  <option value="kg">Kilogram (KG)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Minimum Stock Alert Threshold</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input-field" 
                  value={cropMinStock} 
                  onChange={e => setCropMinStock(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Crop Description / Hindi Label (Optional)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. सरसों / बाजरा"
                  value={cropNotes} 
                  onChange={e => setCropNotes(e.target.value)} 
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCropModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingCrop ? 'Save Changes' : 'Register Crop'}
                </button>
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

export default CerealStock;
