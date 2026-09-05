import React, { useEffect, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, X, Tag, Copy, Check } from 'lucide-react';

const BarcodeGeneratorModal = ({ product, products = [], onClose }) => {
  const targetProducts = product ? [product] : products;
  const [labelCount, setLabelCount] = useState(24);
  const [labelSize, setLabelSize] = useState('sheet'); // 'sheet' or 'single'
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    targetProducts.forEach(prod => {
      const barcodeValue = (prod.barcode || prod.product_code || 'GT-ITEM').trim();
      const svgs = document.querySelectorAll(`.barcode-svg-${prod.id}`);
      svgs.forEach(svg => {
        try {
          JsBarcode(svg, barcodeValue, {
            format: 'CODE128',
            width: 1.5,
            height: 35,
            displayValue: true,
            fontSize: 12,
            font: 'monospace',
            textMargin: 2,
            margin: 0
          });
        } catch (e) {
          console.error('Failed to render barcode:', e);
        }
      });
    });
  }, [targetProducts, labelCount, labelSize]);

  const handlePrint = () => {
    window.print();
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const singleProd = targetProducts[0];
  const activeCode = singleProd?.barcode || singleProd?.product_code || '';

  let printItems = [];
  if (targetProducts.length === 1) {
    printItems = Array(parseInt(labelCount) || 1).fill(targetProducts[0]);
  } else {
    printItems = targetProducts;
  }

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
        
        {/* Modal Header */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                {targetProducts.length > 1 ? `Bulk Barcode Sheet (${targetProducts.length} Items)` : `Barcode Label — ${singleProd?.name || ''}`}
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Code: <code style={{ color: '#3b82f6', fontWeight: 600 }}>{activeCode}</code>
              </span>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '0.4rem', borderRadius: '50%' }}>
            <X size={20} />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="no-print" style={{ padding: '1rem 1.5rem', background: 'var(--bg-secondary)', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            {targetProducts.length === 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Labels to Print:</label>
                <select 
                  className="input-field" 
                  style={{ width: 'auto', padding: '0.35rem 0.75rem' }}
                  value={labelCount} 
                  onChange={e => setLabelCount(Number(e.target.value))}
                >
                  <option value="1">1 Sticker (Single)</option>
                  <option value="6">6 Stickers</option>
                  <option value="12">12 Stickers</option>
                  <option value="24">24 Stickers (A4 Sheet 3x8)</option>
                  <option value="30">30 Stickers (A4 Sheet 3x10)</option>
                  <option value="48">48 Stickers (2 Sheets)</option>
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Format:</label>
              <button 
                type="button"
                className={`btn ${labelSize === 'sheet' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.825rem' }}
                onClick={() => setLabelSize('sheet')}
              >
                A4 Sticker Sheet
              </button>
              <button 
                type="button"
                className={`btn ${labelSize === 'single' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.825rem' }}
                onClick={() => setLabelSize('single')}
              >
                50x25mm Thermal Roll
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => copyCode(activeCode)}
              style={{ fontSize: '0.85rem' }}
            >
              {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy Code'}
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handlePrint}
              style={{ background: '#3b82f6', borderColor: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Printer size={16} /> Print Labels
            </button>
          </div>
        </div>

        {/* Live Preview Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: '#f8fafc' }} id="printable-barcode-area">
          <div 
            className="barcode-labels-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: labelSize === 'single' ? '1fr' : 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '12px',
              maxWidth: labelSize === 'single' ? '240px' : '100%',
              margin: '0 auto'
            }}
          >
            {printItems.map((prod, idx) => (
              <div 
                key={idx}
                className="barcode-label-card"
                style={{
                  background: '#ffffff',
                  color: '#000000',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  pageBreakInside: 'avoid',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                }}
              >
                <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1e293b' }}>
                  GANESH TRADERS
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, margin: '2px 0', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                  {prod.name}
                </div>
                {prod.pack_size && (
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                    Pack: {prod.pack_size}
                  </div>
                )}
                <div style={{ margin: '4px 0' }}>
                  <svg className={`barcode-svg-${prod.id}`} style={{ width: '100%', maxHeight: '42px' }}></svg>
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#047857' }}>
                  MRP: ₹{parseFloat(prod.selling_price || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Embedded Print CSS for sticker alignment */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-barcode-area, #printable-barcode-area * {
            visibility: visible !important;
          }
          #printable-barcode-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 5mm !important;
            background: #fff !important;
          }
          .barcode-label-card {
            border: 0.5px dashed #94a3b8 !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default BarcodeGeneratorModal;
