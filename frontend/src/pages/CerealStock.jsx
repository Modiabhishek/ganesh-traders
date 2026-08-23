import React, { useState, useEffect } from 'react';
import { productAPI } from '../services/api';
import { Search, Edit3, Loader, CheckCircle, ArrowLeft, Printer, RefreshCw } from 'lucide-react';

const CerealStock = ({ setCurrentPage, goBack }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  
  // Modal for quick update
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [newStock, setNewStock] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCostPrice, setNewCostPrice] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Load cereals category and products
  const loadCerealData = async () => {
    setLoading(true);
    try {
      // Find the Cereals & Crops category ID
      const categories = await productAPI.getCategories();
      const cerealCat = categories.find(c => c.name === 'Cereals & Crops');
      
      if (cerealCat) {
        const prods = await productAPI.getProducts(search, cerealCat.id);
        setProducts(prods);
      } else {
        // Fallback: search products by name or code if category not seeded yet
        const prods = await productAPI.getProducts(search);
        const filtered = prods.filter(p => p.product_code.startsWith('CEREAL') || p.unit === 'quintal');
        setProducts(filtered);
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to load cereal stocks.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCerealData();
  }, [search]);

  const handleEditClick = (prod) => {
    setSelectedProduct(prod);
    setNewStock(parseFloat(prod.current_stock).toString());
    setNewPrice(parseFloat(prod.selling_price).toString());
    setNewCostPrice(parseFloat(prod.purchase_price).toString());
    setNewNotes(prod.notes || '');
    setShowModal(true);
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      await productAPI.updateProduct(selectedProduct.id, {
        current_stock: parseFloat(newStock) || 0,
        selling_price: parseFloat(newPrice) || 0,
        purchase_price: parseFloat(newCostPrice) || 0,
        notes: newNotes || null
      });

      setMessage({ text: `Updated stock and rate for ${selectedProduct.name} successfully!`, type: 'success' });
      setShowModal(false);
      loadCerealData();
      
      setTimeout(() => {
        setMessage({ text: '', type: '' });
      }, 3000);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to update stock metrics.', type: 'danger' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Convert stock weight into bags (assuming 50kg bag, 1 quintal = 2 bags)
  const formatBags = (stockQty, unit) => {
    const qty = parseFloat(stockQty) || 0;
    if (unit === 'quintal') {
      const bags = qty * 2;
      return `${bags.toFixed(1)} Bags (बोरी)`;
    } else if (unit === 'kg') {
      const bags = qty / 50;
      return `${bags.toFixed(1)} Bags (बोरी)`;
    }
    return `${qty.toFixed(1)} Bags`;
  };

  // Calculate total valuation
  const totalValuation = products.reduce((acc, p) => {
    const qty = parseFloat(p.current_stock) || 0;
    const rate = parseFloat(p.selling_price) || 0;
    return acc + (qty * rate);
  }, 0);

  return (
    <div className="layout-container" style={{ animation: 'fadeIn 0.25s ease' }}>
      <header className="flex-between no-print" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Cereals & Crops Stock (अनाज स्टॉक)</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Track bag counts, weights, market rates, and stock values</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handlePrint}>
            <Printer size={16} /> Print Stock Sheet
          </button>
          <button className="btn btn-secondary" onClick={loadCerealData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={goBack}>
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </header>

      {/* Print-Only Header */}
      <div className="print-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>GANESH TRADERS — CEREAL STOCK SHEET</h1>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>Live Crop Stock & Valuation Report</p>
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

      {/* Summary Cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Stock Value (कुल मूल्य)</span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.25rem' }}>
              ₹{totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>
        <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Crop Varieties</span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.25rem' }}>
              {products.length} Items
            </h3>
          </div>
        </div>
      </section>

      {/* Search Filter */}
      <section className="glass-panel no-print" style={{ marginBottom: '2rem', padding: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search crop name (e.g. Wheat, Chana)..." 
            style={{ paddingLeft: '2.5rem' }} 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </section>

      {/* Cereals Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader className="spin" size={24} style={{ marginRight: '0.5rem' }} /> Loading crop stocks...
        </div>
      ) : products.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No crop products found. Check if the "Cereals & Crops" category exists in the Catalog.
        </div>
      ) : (
        <section className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem' }}>Crop Code</th>
                <th style={{ padding: '1rem' }}>Crop Name</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Weight Qty</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Equivalent Bags</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Purchase Rate (₹/Qtl)</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Selling Rate (₹/Qtl)</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Estimated Value</th>
                <th style={{ padding: '1rem', textAlign: 'center', width: '100px' }} className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const qty = parseFloat(p.current_stock) || 0;
                const sellPrice = parseFloat(p.selling_price) || 0;
                const buyPrice = parseFloat(p.purchase_price) || 0;
                const val = qty * sellPrice;

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.925rem' }}>
                    <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.product_code}</td>
                    <td style={{ padding: '1rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{p.name}</strong>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.notes || ''}</span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                      {qty.toFixed(2)} <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{p.unit}</span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--primary)', fontWeight: 500 }}>
                      {formatBags(p.current_stock, p.unit)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      ₹{buyPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--success-text)' }}>
                      ₹{sellPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700 }}>
                      ₹{val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }} className="no-print">
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEditClick(p)}
                        title="Update Stock & Rates"
                      >
                        <Edit3 size={14} /> Adjust
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Quick Update Modal */}
      {showModal && selectedProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '440px', background: 'var(--bg-secondary)', animation: 'scaleUp 0.2s ease', padding: '2rem' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Adjust Crop Stock & Rates</h2>
              <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem' }} onClick={() => setShowModal(false)}>✕</button>
            </div>
            
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '1rem' }}>{selectedProduct.name}</h3>

            <form onSubmit={handleUpdateSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Current Stock Quantity ({selectedProduct.unit}) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input-field" 
                  required
                  value={newStock} 
                  onChange={e => setNewStock(e.target.value)} 
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Equivalent to approx {formatBags(newStock, selectedProduct.unit)}
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Purchase Rate (खरीद भाव - ₹/{selectedProduct.unit})</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input-field" 
                  value={newCostPrice} 
                  onChange={e => setNewCostPrice(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Selling Rate (बिक्री भाव - ₹/{selectedProduct.unit}) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input-field" 
                  required
                  value={newPrice} 
                  onChange={e => setNewPrice(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Notes (विवरण)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Moisture 12%, Quality A"
                  value={newNotes} 
                  onChange={e => setNewNotes(e.target.value)} 
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
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
