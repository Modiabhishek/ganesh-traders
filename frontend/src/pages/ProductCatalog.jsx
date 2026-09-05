import React, { useState, useEffect } from 'react';
import { productAPI } from '../services/api';
import { PlusCircle, Search, Edit3, Trash2, ArrowLeft, Loader, AlertTriangle, CheckCircle, XCircle, Printer, Barcode, Tag } from 'lucide-react';
import BarcodeGeneratorModal from '../components/BarcodeGeneratorModal';

const ProductCatalog = ({ setCurrentPage, goBack }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Form Drawer states
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  // Barcode Modal states
  const [barcodeModalProd, setBarcodeModalProd] = useState(null);
  const [showBulkBarcodeModal, setShowBulkBarcodeModal] = useState(false);

  // Product Form Input state
  const [prodForm, setProdForm] = useState({
    name: '',
    barcode: '',
    category_id: '',
    brand: '',
    unit: 'piece',
    pack_size: '',
    purchase_price: '0.00',
    selling_price: '0.00',
    minimum_stock: '5.00',
    notes: ''
  });

  // Category Form Input state
  const [catName, setCatName] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  // Load everything
  const loadData = async () => {
    setLoading(true);
    try {
      const catsData = await productAPI.getCategories();
      setCategories(catsData);

      // If category list has elements and form has empty category_id, auto-select first category
      if (catsData.length > 0 && !prodForm.category_id) {
        setProdForm(prev => ({ ...prev, category_id: catsData[0].id }));
      }

      const prodsData = await productAPI.getProducts(search, selectedCategoryFilter);
      setProducts(prodsData);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to load catalog data.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedCategoryFilter]);

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    
    // Construct payload
    const payload = {
      name: prodForm.name,
      barcode: prodForm.barcode.trim() || null,
      category_id: parseInt(prodForm.category_id),
      brand: prodForm.brand || null,
      unit: prodForm.unit,
      pack_size: prodForm.pack_size || null,
      purchase_price: parseFloat(prodForm.purchase_price) || 0.00,
      selling_price: parseFloat(prodForm.selling_price) || 0.00,
      minimum_stock: parseFloat(prodForm.minimum_stock) || 0.00,
      notes: prodForm.notes || null
    };

    try {
      if (editingProduct) {
        await productAPI.updateProduct(editingProduct.id, payload);
        setMessage({ text: `Product '${payload.name}' updated successfully!`, type: 'success' });
      } else {
        await productAPI.createProduct(payload);
        setMessage({ text: `Product '${payload.name}' added successfully!`, type: 'success' });
      }

      // Close drawer & reload
      setShowForm(false);
      setEditingProduct(null);
      setProdForm({
        name: '',
        barcode: '',
        category_id: categories.length > 0 ? categories[0].id : '',
        brand: '',
        unit: 'piece',
        pack_size: '',
        purchase_price: '0.00',
        selling_price: '0.00',
        minimum_stock: '5.00',
        notes: ''
      });
      loadData();
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || 'Failed to save product details.';
      setMessage({ text: detail, type: 'danger' });
    }
  };

  const handleAddCategorySubmit = async (e) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setMessage({ text: '', type: '' });
    try {
      await productAPI.createCategory(catName.trim());
      setMessage({ text: `Category '${catName}' added successfully!`, type: 'success' });
      setCatName('');
      setShowCategoryForm(false);
      loadData();
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Category already exists or failed to create.', type: 'danger' });
    }
  };

  const handleEditClick = (prod) => {
    setEditingProduct(prod);
    setProdForm({
      name: prod.name,
      barcode: prod.barcode || prod.product_code || '',
      category_id: prod.category_id,
      brand: prod.brand || '',
      unit: prod.unit,
      pack_size: prod.pack_size || '',
      purchase_price: parseFloat(prod.purchase_price).toFixed(2),
      selling_price: parseFloat(prod.selling_price).toFixed(2),
      minimum_stock: parseFloat(prod.minimum_stock).toFixed(2),
      notes: prod.notes || ''
    });
    setShowForm(true);
  };

  const handleDeleteClick = async (prod) => {
    if (!window.confirm(`Are you sure you want to deactivate product '${prod.name}'? It will no longer show in sales selection.`)) {
      return;
    }
    setMessage({ text: '', type: '' });
    try {
      await productAPI.deleteProduct(prod.id);
      setMessage({ text: `Product '${prod.name}' deactivated successfully.`, type: 'success' });
      loadData();
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to deactivate product.', type: 'danger' });
    }
  };

  const getStockStatus = (current, min) => {
    const curVal = parseFloat(current);
    const minVal = parseFloat(min);
    if (curVal <= 0) {
      return { label: 'Out of Stock', class: 'badge-danger', icon: <XCircle size={12} /> };
    }
    if (curVal < minVal) {
      return { label: 'Low Stock', class: 'badge-warning', icon: <AlertTriangle size={12} /> };
    }
    return { label: 'Good Stock', class: 'badge-success', icon: <CheckCircle size={12} /> };
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="layout-container" style={{ animation: 'fadeIn 0.25s ease' }}>
      <header className="flex-between no-print" style={{ marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={goBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Inventory Catalog — Ganesh Traders</h1>
        <button className="btn btn-secondary" onClick={handlePrint}>
          <Printer size={16} /> Print Sheet
        </button>
      </header>

      {/* Print-Only Header */}
      <div className="print-header">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>INVENTORY VALUATION & STOCK LEVEL REPORT</h1>
          <p style={{ fontSize: '0.9rem', color: '#555' }}>Ganesh Traders — Daily Stock Ledger</p>
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

      {/* Primary Actions bar */}
      <section style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search by product name, code or brand..."
            style={{ paddingLeft: '2.5rem' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select 
          className="input-field" 
          style={{ width: '200px' }}
          value={selectedCategoryFilter}
          onChange={e => setSelectedCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button 
          className="btn btn-primary"
          onClick={() => {
            setEditingProduct(null);
            setProdForm({
              name: '',
              category_id: categories.length > 0 ? categories[0].id : '',
              brand: '',
              unit: 'piece',
              pack_size: '',
              purchase_price: '0.00',
              selling_price: '0.00',
              minimum_stock: '5.00',
              notes: ''
            });
            setShowForm(true);
          }}
        >
          <PlusCircle size={16} /> Add Product
        </button>

        <button 
          className="btn btn-secondary"
          onClick={() => setShowCategoryForm(true)}
        >
          <PlusCircle size={16} /> Manage Categories
        </button>

        <button 
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.4)' }}
          onClick={() => setShowBulkBarcodeModal(true)}
          disabled={products.length === 0}
        >
          <Tag size={16} /> Bulk Barcode Sheet ({products.length})
        </button>
      </section>

      {/* Category Creation modal */}
      {showCategoryForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <form onSubmit={handleAddCategorySubmit} className="glass-panel" style={{ width: '100%', maxWidth: '400px', animation: 'scaleUp 0.3s ease' }}>
            <h3 style={{ marginBottom: '1.25rem', fontWeight: 700 }}>Add Product Category</h3>
            <div className="form-group">
              <label className="form-label">Category Name</label>
              <input 
                type="text" 
                className="input-field" 
                required 
                placeholder="e.g. Spices, Detergents"
                value={catName} 
                onChange={e => setCatName(e.target.value)} 
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCategoryForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Category</button>
            </div>
          </form>
        </div>
      )}

      {/* Product Form Drawer Drawer */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <form onSubmit={handleProductSubmit} className="glass-panel" style={{ width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', animation: 'scaleUp 0.3s ease', padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>{editingProduct ? 'Edit Product Details' : 'Add New Product'}</h3>
            
            <div className="form-group">
              <label className="form-label">Product Name (उत्पाद का नाम) *</label>
              <input 
                type="text" 
                className="input-field" 
                required 
                value={prodForm.name} 
                onChange={e => setProdForm({...prodForm, name: e.target.value})} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Barcode / SKU (बारकोड नंबर)</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Scan barcode or leave blank to auto-use product code"
                value={prodForm.barcode} 
                onChange={e => setProdForm({...prodForm, barcode: e.target.value})} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select 
                  className="input-field" 
                  required
                  value={prodForm.category_id} 
                  onChange={e => setProdForm({...prodForm, category_id: e.target.value})}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Brand / Manufacturer</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={prodForm.brand} 
                  onChange={e => setProdForm({...prodForm, brand: e.target.value})} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Unit of Measure (UoM)</label>
                <select 
                  className="input-field" 
                  value={prodForm.unit} 
                  onChange={e => setProdForm({...prodForm, unit: e.target.value})}
                >
                  <option value="piece">piece (नग)</option>
                  <option value="kg">kg (किलोग्राम)</option>
                  <option value="packet">packet (पैकेट)</option>
                  <option value="litre">litre (लीटर)</option>
                  <option value="box">box</option>
                  <option value="dozen">dozen</option>
                  <option value="gram">gram</option>
                  <option value="ml">ml</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Pack Size (e.g. 5 kg, 200g)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={prodForm.pack_size} 
                  onChange={e => setProdForm({...prodForm, pack_size: e.target.value})} 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Purchase Rate (₹)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input-field" 
                  value={prodForm.purchase_price} 
                  onChange={e => setProdForm({...prodForm, purchase_price: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Selling Price (₹) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="input-field" 
                  required
                  value={prodForm.selling_price} 
                  onChange={e => setProdForm({...prodForm, selling_price: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Min Stock Limit</label>
                <input 
                  type="number" 
                  step="0.1" 
                  className="input-field" 
                  value={prodForm.minimum_stock} 
                  onChange={e => setProdForm({...prodForm, minimum_stock: e.target.value})} 
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes (विवरण)</label>
              <textarea 
                className="input-field" 
                rows="2"
                value={prodForm.notes} 
                onChange={e => setProdForm({...prodForm, notes: e.target.value})} 
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => {
                setShowForm(false);
                setEditingProduct(null);
              }}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Product</button>
            </div>
          </form>
        </div>
      )}

      {/* Products Inventory Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader className="spin" size={24} style={{ marginRight: '0.5rem' }} /> Loading products list...
        </div>
      ) : products.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No products matched the filters. Click "Add Product" to populate your inventory ledger.
        </div>
      ) : (
        <section className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem', width: '100px' }}>Code</th>
                <th style={{ padding: '1rem' }}>Product Name</th>
                <th style={{ padding: '1rem' }}>Category</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Cost Price (₹)</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Sale Price (₹)</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Current Stock</th>
                <th style={{ padding: '1rem', textAlign: 'center' }}>Stock Status</th>
                <th style={{ padding: '1rem', width: '120px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const status = getStockStatus(p.current_stock, p.minimum_stock);
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.925rem' }}>
                    <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.product_code}</td>
                    <td style={{ padding: '1rem' }}>
                      <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{p.name}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.brand || 'No Brand'} {p.pack_size ? `| Pack: ${p.pack_size}` : ''}</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {categories.find(c => c.id === p.category_id)?.name || 'Other'}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      ₹{parseFloat(p.purchase_price).toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                      ₹{parseFloat(p.selling_price).toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                      {parseFloat(p.current_stock).toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>{p.unit}</span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span className={`badge ${status.class}`} style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                        {status.icon} {status.label}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.4rem', color: '#3b82f6' }}
                          title="Generate & Print Barcode Labels"
                          onClick={() => setBarcodeModalProd(p)}
                        >
                          <Barcode size={14} />
                        </button>

                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.4rem' }}
                          title="Edit Product"
                          onClick={() => handleEditClick(p)}
                        >
                          <Edit3 size={14} />
                        </button>
                        
                        {p.product_code !== 'PROD-GENERAL' && (
                          <button 
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.4rem', color: 'var(--danger)' }}
                            title="Deactivate Product"
                            onClick={() => handleDeleteClick(p)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Barcode Generator Modals */}
      {barcodeModalProd && (
        <BarcodeGeneratorModal 
          product={barcodeModalProd} 
          onClose={() => setBarcodeModalProd(null)} 
        />
      )}

      {showBulkBarcodeModal && (
        <BarcodeGeneratorModal 
          products={products} 
          onClose={() => setShowBulkBarcodeModal(false)} 
        />
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
          /* Hide the actions columns during stock log prints */
          th:nth-child(8), td:nth-child(8) {
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

export default ProductCatalog;
