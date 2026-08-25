import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { Users, UserPlus, Trash2, ArrowLeft, Loader, Key, ShieldCheck } from 'lucide-react';

const StaffManager = ({ setCurrentPage, goBack }) => {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Staff');
  const [message, setMessage] = useState({ text: '', type: '' });

  // Edit Staff states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState('Staff');

  const loadStaff = async () => {
    setLoading(true);
    try {
      const data = await authAPI.getUsers();
      setStaffList(data);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || 'Only admins can view staff records.';
      setMessage({ text: detail, type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (username.trim().length < 3) {
      setMessage({ text: 'Username must be at least 3 characters.', type: 'danger' });
      return;
    }
    if (password.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters.', type: 'danger' });
      return;
    }

    try {
      await authAPI.register(username.trim(), password, role);
      setMessage({ text: `Staff account for '${username}' registered successfully!`, type: 'success' });
      setUsername('');
      setPassword('');
      setRole('Staff');
      setShowAddForm(false);
      loadStaff();
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || 'Failed to register staff account.';
      setMessage({ text: detail, type: 'danger' });
    }
  };

  const handleDeleteStaff = async (staff) => {
    if (staff.username === 'admin') {
      alert('System default admin cannot be deactivated.');
      return;
    }
    if (!window.confirm(`Are you sure you want to deactivate staff account '${staff.username}'? they will immediately lose access to log in.`)) {
      return;
    }

    setMessage({ text: '', type: '' });
    try {
      await authAPI.deleteUser(staff.id);
      setMessage({ text: `Staff account '${staff.username}' deactivated successfully.`, type: 'success' });
      loadStaff();
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Failed to deactivate staff account.', type: 'danger' });
    }
  };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    if (editUsername.trim().length < 3) {
      alert("Username must be at least 3 characters.");
      return;
    }
    if (editPassword && editPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    try {
      await authAPI.updateUser(editingStaff.id, {
        username: editUsername.trim(),
        password: editPassword || null,
        role: editRole
      });
      setMessage({ text: `Staff account updated successfully!`, type: 'success' });
      setShowEditModal(false);
      setEditingStaff(null);
      loadStaff();
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || 'Failed to update staff account.';
      alert(detail);
    }
  };

  return (
    <div className="layout-container" style={{ animation: 'fadeIn 0.25s ease' }}>
      <header className="flex-between" style={{ marginBottom: '2rem' }}>
        <button className="btn btn-secondary" onClick={goBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Staff & Permissions — Ganesh Traders</h1>
      </header>

      {message.text && (
        <div className={`badge badge-${message.type}`} style={{ width: '100%', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'block', textTransform: 'none' }}>
          {message.text}
        </div>
      )}

      {/* Action button */}
      <section style={{ marginBottom: '1.5rem' }}>
        <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
          <UserPlus size={16} /> Create Staff Login
        </button>
      </section>

      {/* Inline Registration Form */}
      {showAddForm && (
        <form className="glass-panel" onSubmit={handleAddStaff} style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', padding: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Username *</label>
            <input 
              type="text" 
              className="input-field" 
              required 
              placeholder="e.g. suresh_kirana"
              value={username} 
              onChange={e => setUsername(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password * (Min 6 chars)</label>
            <input 
              type="password" 
              className="input-field" 
              required 
              placeholder="••••••"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Role Level</label>
            <select className="input-field" value={role} onChange={e => setRole(e.target.value)}>
              <option value="Staff">Staff (बिक्री कर्मचारी - Restricted POS access)</option>
              <option value="Admin">Admin (पूर्ण अधिकार - Complete system control)</option>
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Account</button>
          </div>
        </form>
      )}

      {/* Staff directory grid listing */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader className="spin" size={24} style={{ marginRight: '0.5rem' }} /> Loading staff credentials...
        </div>
      ) : staffList.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No staff records. Only default system admin is registered.
        </div>
      ) : (
        <section className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <th style={{ padding: '1rem', width: '80px' }}>User ID</th>
                <th style={{ padding: '1rem' }}>Username (लॉगिन नाम)</th>
                <th style={{ padding: '1rem' }}>Access Permissions</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem' }}>Registered On</th>
                <th style={{ padding: '1rem', width: '100px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map(staff => (
                <tr key={staff.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.925rem' }}>
                  <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{staff.id}</td>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Key size={14} style={{ color: 'var(--text-muted)' }} /> {staff.username}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge ${staff.role === 'Admin' ? 'badge-danger' : 'badge-success'}`} style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
                      <ShieldCheck size={12} /> {staff.role}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span className="badge badge-success">Active</span>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                    {new Date(staff.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                      <button 
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.4rem 0.65rem' }}
                        title="Edit staff details"
                        onClick={() => {
                          setEditingStaff(staff);
                          setEditUsername(staff.username);
                          setEditPassword('');
                          setEditRole(staff.role);
                          setShowEditModal(true);
                        }}
                      >
                        Edit
                      </button>
                      {staff.username !== 'admin' && (
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.4rem', color: 'var(--danger)' }}
                          title="Deactivate staff login"
                          onClick={() => handleDeleteStaff(staff)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Edit Staff Modal */}
      {showEditModal && editingStaff && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '440px', background: 'var(--bg-secondary)', animation: 'scaleUp 0.2s ease', padding: '2rem' }}>
            <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Edit Staff Account</h2>
              <button 
                type="button" 
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--text-secondary)' }}
                onClick={() => { setShowEditModal(false); setEditingStaff(null); }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateStaff}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Username *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  required 
                  value={editUsername} 
                  onChange={e => setEditUsername(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">New Password (Leave blank to keep current)</label>
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="Enter new password (min 6 characters)"
                  value={editPassword} 
                  onChange={e => setEditPassword(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">Role Level</label>
                <select 
                  className="input-field" 
                  disabled={editingStaff.username === 'admin'}
                  value={editRole} 
                  onChange={e => setEditRole(e.target.value)}
                >
                  <option value="Staff">Staff (बिक्री कर्मचारी - POS access only)</option>
                  <option value="Admin">Admin (पूर्ण अधिकार - Complete control)</option>
                </select>
                {editingStaff.username === 'admin' && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                    The default admin role level cannot be modified.
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditingStaff(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--primary)', color: 'white' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManager;
