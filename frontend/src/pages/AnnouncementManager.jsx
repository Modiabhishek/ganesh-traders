import React, { useState, useEffect } from 'react';
import { customerAPI } from '../services/api';
import { Bell, PlusCircle, Trash2, RefreshCw, X, AlertCircle } from 'lucide-react';

const parseNaiveDate = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  try {
    let workingStr = dateStr;
    if (!dateStr.includes('Z') && !dateStr.includes('+')) {
      workingStr = dateStr + 'Z';
    }
    return new Date(workingStr);
  } catch (e) {
    return new Date(dateStr);
  }
};

const AnnouncementManager = ({ setCurrentPage, goBack }) => {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  const loadUpdates = async () => {
    setLoading(true);
    try {
      const data = await customerAPI.getLiveUpdates();
      setUpdates(data || []);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to load updates list.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUpdates();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      await customerAPI.addLiveUpdate({ title: title.trim(), content: content.trim() });
      setMessage({ text: 'Store update published successfully!', type: 'success' });
      setShowAddModal(false);
      setTitle('');
      setContent('');
      loadUpdates();
      
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to publish store update.', type: 'danger' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this update? Customers will no longer see it.")) return;
    try {
      await customerAPI.deleteLiveUpdate(id);
      setMessage({ text: 'Store update removed.', type: 'success' });
      loadUpdates();
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to delete update.', type: 'danger' });
    }
  };

  return (
    <div className="layout-container" style={{ animation: 'fadeIn 0.25s ease' }}>
      <header className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Live Portal Announcements</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Publish updates, announcements, crop rates, and messages for customers</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={loadUpdates}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <PlusCircle size={16} /> New Announcement
          </button>
        </div>
      </header>

      {message.text && (
        <div className={`badge badge-${message.type}`} style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'block', textTransform: 'none' }}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ borderTopColor: 'var(--primary)', width: '30px', height: '30px', borderWidth: '3px', animation: 'spin 1s linear infinite', borderRadius: '50%', borderStyle: 'solid', borderColor: '#e2e8f0' }}></div>
        </div>
      ) : updates.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <AlertCircle size={32} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <p>No active announcements posted yet.</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }} onClick={() => setShowAddModal(true)}>
            Post First Announcement
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {updates.map(up => (
            <div key={up.id} className="glass-panel" style={{ padding: '1.5rem', position: 'relative', borderLeft: '5px solid var(--primary)' }}>
              
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fee2e2' }}
                onClick={() => handleDelete(up.id)}
                title="Delete Announcement"
              >
                <Trash2 size={14} /> Remove
              </button>

              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.25rem', width: '80%' }}>{up.title}</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '1rem' }}>
                Published on: {parseNaiveDate(up.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                {up.content}
              </p>

            </div>
          ))}
        </div>
      )}

      {/* Add Announcement Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '480px', background: 'var(--bg-secondary)', animation: 'scaleUp 0.2s ease', padding: '2rem' }}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Post Live Announcement</h2>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowAddModal(false)} />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Announcement Title *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  required
                  placeholder="e.g. Festival Greetings or Crop Rates"
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Content (Message for Portal) *</label>
                <textarea 
                  className="input-field" 
                  required
                  rows="5"
                  placeholder="Type your announcement content here. This is visible instantly to all logged-in customers."
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  value={content} 
                  onChange={e => setContent(e.target.value)} 
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Publish Announcement</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementManager;
