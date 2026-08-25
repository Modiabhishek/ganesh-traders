import React, { useState, useEffect } from 'react';
import { authAPI } from './services/api';
import Dashboard from './pages/Dashboard';
import CustomerList from './pages/CustomerList';
import Ledger from './pages/Ledger';
import NewSale from './pages/NewSale';
import CustomerImport from './pages/CustomerImport';
import ProductCatalog from './pages/ProductCatalog';
import CerealStock from './pages/CerealStock';
import TransactionHistory from './pages/TransactionHistory';
import StaffManager from './pages/StaffManager';
import ExpenseManager from './pages/ExpenseManager';
import CustomerPortal from './pages/CustomerPortal';
import AnnouncementManager from './pages/AnnouncementManager';
import { Sun, Moon, LogOut, LayoutDashboard, Users, PlusCircle, Upload, LogIn, ClipboardList, History, Shield, TrendingDown, Sprout, Bell } from 'lucide-react';

const decodeToken = (token) => {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectCustomerId, setSelectCustomerId] = useState(null);
  const [pageHistory, setPageHistory] = useState(['dashboard']);

  const navigateTo = (page) => {
    setPageHistory(prev => {
      if (prev[prev.length - 1] === page) return prev;
      return [...prev, page];
    });
    setCurrentPage(page);
  };

  const goBack = () => {
    setPageHistory(prev => {
      if (prev.length <= 1) {
        setCurrentPage('dashboard');
        return ['dashboard'];
      }
      const newHistory = [...prev];
      newHistory.pop(); // Remove current page
      const prevPage = newHistory[newHistory.length - 1];
      setCurrentPage(prevPage || 'dashboard');
      return newHistory;
    });
  };
  
  const isCapacitor = (window.location.hostname === 'localhost' && !window.location.port) || 
                      window.location.protocol === 'capacitor:' || 
                      window.location.hostname === 'capacitor';

  // Login Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverIP, setServerIP] = useState(localStorage.getItem('server_ip') || '192.168.1.15');
  
  // Theme state
  const [darkTheme, setDarkTheme] = useState(localStorage.getItem('theme') === 'dark');

  // Sync theme to body element
  useEffect(() => {
    if (darkTheme) {
      document.body.classList.add('dark-theme');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [darkTheme]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    try {
      const data = await authAPI.login(username, password);
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      setCurrentPage('dashboard');
    } catch (err) {
      console.error(err);
      if (!err.response || (err.message && err.message.toLowerCase().includes('network error'))) {
        setAuthError(`Connection failed! Make sure your phone is on the same Wi-Fi, the server PC is running, and the IP address below is correct.`);
      } else {
        setAuthError('Incorrect username or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setCurrentPage('dashboard');
    setUsername('');
    setPassword('');
  };

  // Render Login Panel
  if (!token) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '1rem' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem 2rem', animation: 'scaleUp 0.3s ease' }}>
          <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#b91c1c', marginBottom: '0.75rem', letterSpacing: '0.5px' }}>
              ।। श्री गणेशाय नमः ।। श्री श्याम देवाय नमः ।। श्री पितृदेवाय नमः ।।
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>Ganesh Traders</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Sign in to manage your family business</p>
          </header>

          {authError && (
            <div className="badge badge-danger" style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', display: 'block', textTransform: 'none' }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input 
                type="text" 
                className="input-field" 
                required 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="input-field" 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem' }} disabled={loading}>
              <LogIn size={16} /> {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {isCapacitor && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', animation: 'fadeIn 0.3s ease' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                Server PC IP Address (Wi-Fi IP)
              </label>
              <input 
                type="text" 
                className="input-field" 
                style={{ fontSize: '0.9rem', padding: '0.6rem 0.75rem', background: 'var(--bg-primary)' }}
                value={serverIP}
                onChange={e => {
                  setServerIP(e.target.value);
                  localStorage.setItem('server_ip', e.target.value);
                }}
                placeholder="e.g. 192.168.1.15"
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                Change this if the server PC has a different IP on your Wi-Fi network.
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const userPayload = decodeToken(token);
  const userRole = userPayload?.role || null;

  if (userRole === 'Customer') {
    return <CustomerPortal token={token} onLogout={handleLogout} />;
  }

  // Render Page Content Component
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard setCurrentPage={navigateTo} goBack={goBack} setSelectCustomerId={setSelectCustomerId} />;
      case 'customers':
        return <CustomerList setCurrentPage={navigateTo} goBack={goBack} setSelectCustomerId={setSelectCustomerId} />;
      case 'ledger':
        return <Ledger customerId={selectCustomerId} setCurrentPage={navigateTo} goBack={goBack} />;
      case 'new-sale':
        return <NewSale setCurrentPage={navigateTo} goBack={goBack} />;
      case 'import-customers':
        return <CustomerImport setCurrentPage={navigateTo} goBack={goBack} />;
      case 'products':
        return <ProductCatalog setCurrentPage={navigateTo} goBack={goBack} />;
      case 'cereal-stock':
        return <CerealStock setCurrentPage={navigateTo} goBack={goBack} />;
      case 'announcements':
        return <AnnouncementManager setCurrentPage={navigateTo} goBack={goBack} />;
      case 'transactions':
        return <TransactionHistory setCurrentPage={navigateTo} goBack={goBack} />;
      case 'expenses':
        return <ExpenseManager setCurrentPage={navigateTo} goBack={goBack} />;
      case 'staff':
        return <StaffManager setCurrentPage={navigateTo} goBack={goBack} />;
      default:
        return <Dashboard setCurrentPage={navigateTo} goBack={goBack} setSelectCustomerId={setSelectCustomerId} />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      
      {/* Navigation Sidebar (Hidden during browser Print) */}
      <aside className="no-print" style={{ width: '260px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem' }}>
        <div style={{ marginBottom: '2.5rem', paddingLeft: '0.5rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--primary)' }}>Ganesh Traders</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>v1.0 Go-Live Ready</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button 
            className={`btn ${currentPage === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', border: currentPage === 'dashboard' ? 'none' : '1px solid transparent' }}
            onClick={() => navigateTo('dashboard')}
          >
            <LayoutDashboard size={18} /> Dashboard
          </button>
          
          <button 
            className={`btn ${currentPage === 'customers' || currentPage === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', border: currentPage === 'customers' || currentPage === 'ledger' ? 'none' : '1px solid transparent' }}
            onClick={() => navigateTo('customers')}
          >
            <Users size={18} /> Customers
          </button>

          <button 
            className={`btn ${currentPage === 'new-sale' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', border: currentPage === 'new-sale' ? 'none' : '1px solid transparent' }}
            onClick={() => navigateTo('new-sale')}
          >
            <PlusCircle size={18} /> New Sale
          </button>

          <button 
            className={`btn ${currentPage === 'products' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', border: currentPage === 'products' ? 'none' : '1px solid transparent' }}
            onClick={() => navigateTo('products')}
          >
            <ClipboardList size={18} /> Product Catalog
          </button>

          <button 
            className={`btn ${currentPage === 'cereal-stock' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', border: currentPage === 'cereal-stock' ? 'none' : '1px solid transparent' }}
            onClick={() => navigateTo('cereal-stock')}
          >
            <Sprout size={18} style={{ color: '#eab308' }} /> Crop Stock (अनाज)
          </button>

          <button 
            className={`btn ${currentPage === 'announcements' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', border: currentPage === 'announcements' ? 'none' : '1px solid transparent' }}
            onClick={() => navigateTo('announcements')}
          >
            <Bell size={18} style={{ color: '#ec4899' }} /> Live Updates (घोषणाएं)
          </button>

          <button 
            className={`btn ${currentPage === 'transactions' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', border: currentPage === 'transactions' ? 'none' : '1px solid transparent' }}
            onClick={() => navigateTo('transactions')}
          >
            <History size={18} /> Transaction Logs
          </button>

          <button 
            className={`btn ${currentPage === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', border: currentPage === 'expenses' ? 'none' : '1px solid transparent' }}
            onClick={() => navigateTo('expenses')}
          >
            <TrendingDown size={18} /> Expenses
          </button>

          <button 
            className={`btn ${currentPage === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', border: currentPage === 'staff' ? 'none' : '1px solid transparent' }}
            onClick={() => navigateTo('staff')}
          >
            <Shield size={18} /> Staff Manager
          </button>
 
          <button 
            className={`btn ${currentPage === 'import-customers' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ justifyContent: 'flex-start', border: currentPage === 'import-customers' ? 'none' : '1px solid transparent' }}
            onClick={() => navigateTo('import-customers')}
          >
            <Upload size={18} /> Import Data
          </button>
        </nav>

        {/* Theme and Logout Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <button 
            className="btn btn-secondary" 
            style={{ justifyContent: 'flex-start' }}
            onClick={() => setDarkTheme(!darkTheme)}
          >
            {darkTheme ? <Sun size={18} /> : <Moon size={18} />} {darkTheme ? 'Light Theme' : 'Dark Theme'}
          </button>
          
          <button 
            className="btn btn-secondary" 
            style={{ justifyContent: 'flex-start', color: 'var(--danger-text)' }}
            onClick={handleLogout}
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {renderPage()}
      </main>

    </div>
  );
}

export default App;
