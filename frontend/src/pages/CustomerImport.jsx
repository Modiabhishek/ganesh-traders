import React, { useState } from 'react';
import { customerAPI } from '../services/api';
import { ArrowLeft, Upload, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

const CustomerImport = ({ setCurrentPage, goBack }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage({ text: 'Please select a CSV file first.', type: 'danger' });
      return;
    }

    try {
      setLoading(true);
      setMessage({ text: '', type: '' });
      const data = await customerAPI.importPreview(file);
      setPreview(data);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to parse CSV file. Verify the file format.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!preview) return;

    try {
      setLoading(true);
      // Filter out rows with critical validation errors (like empty names)
      // and skip duplicate rows to keep database clean.
      const importableRows = preview.rows
        .filter(r => r.errors.length === 0 && !r.is_duplicate)
        .map(r => ({
          name: r.name,
          mobile: r.mobile,
          address: r.address,
          customer_type: r.customer_type,
          payment_type: r.payment_type,
          opening_balance: parseFloat(r.opening_balance),
          credit_limit: parseFloat(r.credit_limit),
          notes: r.notes
        }));

      if (importableRows.length === 0) {
        setMessage({ text: 'No valid non-duplicate rows found to import.', type: 'danger' });
        setLoading(false);
        return;
      }

      const res = await customerAPI.importConfirm(importableRows);
      setMessage({ text: res.message || 'Import completed successfully.', type: 'success' });
      
      // Auto redirect to customer list after 1.5s
      setTimeout(() => {
        setCurrentPage('customers');
      }, 1500);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to confirm customer import.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="layout-container" style={{ animation: 'fadeIn 0.25s ease' }}>
      <header className="flex-between" style={{ marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={goBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Import Customer Data</h1>
      </header>

      {message.text && (
        <div className={`badge badge-${message.type}`} style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'block', textTransform: 'none' }}>
          {message.text}
        </div>
      )}

      {/* File Upload Form */}
      {!preview && (
        <form className="glass-panel" onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '3rem 2rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={32} />
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Upload Customer Sheet</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Select a customer spreadsheet in CSV format</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <input 
              type="file" 
              accept=".csv" 
              id="csv-file" 
              style={{ display: 'none' }} 
              onChange={handleFileChange} 
            />
            <label htmlFor="csv-file" className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              {file ? file.name : 'Choose CSV File'}
            </label>
            {file && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {(file.size / 1024).toFixed(1)} KB
              </span>
            )}
          </div>

          <button type="submit" className="btn btn-primary" style={{ minWidth: '160px' }} disabled={loading}>
            {loading ? 'Uploading & Analyzing...' : 'Analyze Spreadsheet'}
          </button>
        </form>
      )}

      {/* Import Preview & Duplicate Resolver Screen */}
      {preview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Analysis Dashboard Summary */}
          <section className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Rows Found</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 700 }}>{preview.total_rows}</h2>
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Valid to Import</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>{preview.valid_count}</h2>
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Duplicates (Will be Skipped)</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning)' }}>{preview.duplicate_count}</h2>
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Critical Errors</span>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--danger)' }}>{preview.error_count}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setPreview(null)}>Reset</button>
              <button 
                className="btn btn-primary" 
                onClick={handleConfirmImport}
                disabled={loading || preview.valid_count === 0}
              >
                {loading ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </section>

          {/* Detailed Preview Table */}
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Spreadsheet Rows Detail</h3>
          <section className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem' }}>
                  <th style={{ padding: '1rem', width: '60px' }}>Row</th>
                  <th style={{ padding: '1rem' }}>Name</th>
                  <th style={{ padding: '1rem' }}>Mobile</th>
                  <th style={{ padding: '1rem' }}>Address</th>
                  <th style={{ padding: '1rem' }}>Type</th>
                  <th style={{ padding: '1rem', textAlign: 'right' }}>Opening Balance</th>
                  <th style={{ padding: '1rem' }}>Import Status & Logs</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.row_index} style={{ borderBottom: '1px solid var(--border-color)', opacity: row.errors.length > 0 ? 0.6 : 1 }}>
                    <td style={{ padding: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>{row.row_index}</td>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{row.name || <span style={{ color: 'var(--danger)' }}>[Missing Name]</span>}</td>
                    <td style={{ padding: '1rem' }}>{row.mobile || <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>N/A</span>}</td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{row.address || '-'}</td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{row.customer_type} / {row.payment_type}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 500 }}>
                      ₹{parseFloat(row.opening_balance).toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {row.errors.map((err, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--danger-text)', fontSize: '0.8rem', fontWeight: 500 }}>
                            <AlertCircle size={12} /> {err}
                          </div>
                        ))}
                        {row.is_duplicate && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--warning-text)', fontSize: '0.8rem', fontWeight: 500 }}>
                            <AlertTriangle size={12} /> {row.duplicate_reason}
                          </div>
                        )}
                        {row.warnings.map((warn, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            <AlertTriangle size={12} /> {warn}
                          </div>
                        ))}
                        {!row.is_duplicate && row.errors.length === 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success-text)', fontSize: '0.8rem', fontWeight: 600 }}>
                            <CheckCircle2 size={12} /> Ready to import
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
};

export default CustomerImport;
