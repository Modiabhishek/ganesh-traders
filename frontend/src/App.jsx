import React, { useState, useEffect } from 'react';
// Vercel auto-deploy trigger
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
import { Sun, Moon, LogOut, LayoutDashboard, Users, PlusCircle, Upload, LogIn, ClipboardList, History, Shield, TrendingDown, Sprout, Bell, Menu, X, Store, ShoppingBag, Sparkles, Package } from 'lucide-react';

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
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

  useEffect(() => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, [currentPage]);

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

  // Shutter state
  const [showShutter, setShowShutter] = useState(false);
  const [isShutterOpening, setIsShutterOpening] = useState(false);

  // Curtain state
  const [showCurtain, setShowCurtain] = useState(false);
  const [isCurtainOpening, setIsCurtainOpening] = useState(true);

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
      
      // 1. Mount curtains in open state and slide them closed over the login page
      setShowCurtain(true);
      setIsCurtainOpening(true);
      setShowShutter(true);
      setIsShutterOpening(false);

      setTimeout(() => {
        setIsCurtainOpening(false); // Slide closed
      }, 50);

      // 2. Once curtains are fully closed (after 1200ms), update the token in state
      // This will change the page underneath to the main app (displaying the closed shutter behind the curtains)
      setTimeout(() => {
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
      }, 1200);

      // 3. Slide open the curtains to reveal the closed shutter
      setTimeout(() => {
        setIsCurtainOpening(true);
      }, 1500);

      // 4. Start rolling up the shop shutter after curtains slide open
      setTimeout(() => {
        setIsShutterOpening(true);
      }, 2700);

      // 5. Clear all overlays
      setTimeout(() => {
        setShowCurtain(false);
        setIsCurtainOpening(false);
        setShowShutter(false);
        setIsShutterOpening(false);
      }, 4000);

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
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle, var(--bg-secondary) 30%, var(--bg-primary) 100%)', padding: '1rem', position: 'relative', overflow: 'hidden' }}>
        
        {/* Theater Curtains (Always visible on sides of Login Page) */}
        <div className="theater-curtains-overlay no-print">
          <div className="curtain-valance" />
          <div className={`curtain-panel left-curtain ${isCurtainOpening ? 'curtain-open' : ''}`} />
          <div className={`curtain-panel right-curtain ${isCurtainOpening ? 'curtain-open' : ''}`} />
        </div>

        {/* Decorative Garland of Flowers (गेंदे के फूल की माला) */}
        <div className="flower-garland no-print">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="flower-node" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>

        {/* Floating Grocery Theme Icons in Background */}
        <div className="grocery-theme-bg no-print">
          <div className="floating-item item-1" style={{ top: '15%', left: '12%' }}><Store size={48} /></div>
          <div className="floating-item item-2" style={{ top: '65%', left: '80%', animationDelay: '1s' }}><ShoppingBag size={44} /></div>
          <div className="floating-item item-3" style={{ top: '75%', left: '15%', animationDelay: '2s' }}><Package size={40} /></div>
          <div className="floating-item item-4" style={{ top: '20%', left: '82%', animationDelay: '3s' }}><Sprout size={44} /></div>
          <div className="floating-item item-5" style={{ top: '45%', left: '8%', animationDelay: '4.5s' }}><Sparkles size={36} /></div>
          <div className="floating-item item-6" style={{ top: '80%', left: '50%', animationDelay: '1.5s' }}><Store size={36} /></div>
        </div>

        {/* Central Login Card */}
        <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem 2rem', zIndex: 10, animation: 'scaleUp 0.35s ease', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', borderTop: '4px solid var(--primary)', position: 'relative', background: 'rgba(var(--bg-secondary-rgb), 0.8)' }}>
          <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ea580c', marginBottom: '0.75rem', letterSpacing: '1px' }}>
              ।। श्री गणेशाय नमः ।। श्री श्याम देवाय नमः ।। श्री पितृदेवाय नमः ।।
            </div>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.02em', marginBottom: '0.25rem', textShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>गणेश ट्रेडर्स</h1>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f59e0b', marginBottom: '1rem', letterSpacing: '0.5px' }}>
              डिजिटल स्टोर - आपका विश्वसनीय किराना व्यापार
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Sign in to manage your digital store dashboard</p>
          </header>

          {authError && (
            <div className="badge badge-danger" style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', display: 'block', textTransform: 'none' }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Username</label>
              <input 
                type="text" 
                className="input-field" 
                required 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                placeholder="e.g. admin"
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: '1.75rem' }}>
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="input-field" 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1rem' }} disabled={loading}>
              <LogIn size={18} /> {loading ? 'Signing in...' : 'Sign In'}
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
            </div>
          )}
        </div>

        {/* Local CSS for Garland & Floating items */}
        <style>{`
          .flower-garland {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 35px;
            display: flex;
            justify-content: space-around;
            pointer-events: none;
            z-index: 50;
            padding: 0 10px;
          }
          .flower-node {
            width: 22px;
            height: 22px;
            background: radial-gradient(circle, #f59e0b 45%, #ea580c 85%);
            border-radius: 50%;
            box-shadow: 0 3px 6px rgba(0,0,0,0.15), inset 0 2px 2px rgba(255,255,255,0.4);
            transform-origin: top center;
            animation: swing 4s ease-in-out infinite alternate;
            position: relative;
          }
          .flower-node::before {
            content: '';
            position: absolute;
            top: -6px;
            left: 10px;
            width: 2px;
            height: 8px;
            background: #15803d; /* Green stem thread */
          }
          .flower-node:nth-child(even) {
            background: radial-gradient(circle, #ea580c 45%, #b45309 85%);
          }
          .grocery-theme-bg {
            position: absolute;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            overflow: hidden;
            pointer-events: none;
            z-index: 1;
          }
          .floating-item {
            position: absolute;
            color: rgba(245, 158, 11, 0.15); /* Gold transparent */
            animation: floatSlow 6s infinite alternate ease-in-out;
          }
          @keyframes swing {
            0% { transform: rotate(-8deg); }
            100% { transform: rotate(8deg); }
          }
          @keyframes floatSlow {
            0% { transform: translateY(0px) rotate(0deg); }
            100% { transform: translateY(-30px) rotate(20deg); }
          }
        `}</style>
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
    <div className="sidebar-container" style={{ display: 'flex', minHeight: '100vh' }}>
      
      {/* Mobile Top Header (Show only on phone view) */}
      <header className="mobile-header no-print">
        <button className="menu-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu size={24} />
        </button>
        <span className="mobile-title">गणेश ट्रेडर्स</span>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>।। श्री गणेशाय नमः ।।</div>
      </header>

      {/* Sidebar overlay to close sidebar when clicking outside on mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Navigation Sidebar (Hidden during browser Print) */}
      <aside className={`app-sidebar no-print ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', paddingLeft: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--primary)' }}>Ganesh Traders</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>v1.0 Go-Live Ready</span>
          </div>
          {/* Close button inside sidebar on mobile */}
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
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
      <main className="app-main-content" style={{ flex: 1, overflowY: 'auto' }}>
        {renderPage()}
      </main>

      {/* Theater Curtains Opening Animation Overlay */}
      {showCurtain && (
        <div className="theater-curtains-overlay no-print">
          <div className="curtain-valance" />
          <div className={`curtain-panel left-curtain ${isCurtainOpening ? 'curtain-open' : ''}`} />
          <div className={`curtain-panel right-curtain ${isCurtainOpening ? 'curtain-open' : ''}`} />
        </div>
      )}

      {/* Shop Shutter Opening Animation Overlay */}
      {showShutter && (
        <div 
          className={`shop-shutter-overlay ${isShutterOpening ? 'shutter-open' : ''}`}
        >
          {/* Corrugated Shutter Steel Body */}
          <div className="shutter-body">
            {[...Array(24)].map((_, i) => (
              <div key={i} className="shutter-segment" />
            ))}
            
            {/* Shop Board on Shutter */}
            <div className="shutter-board">
              <div className="shutter-blessing">
                ।। श्री गणेशाय नमः ।। श्री श्याम देवाय नमः ।। श्री पितृदेवाय नमः ।।
              </div>
              <h1 className="shutter-title">गणेश ट्रेडर्स</h1>
              <div className="shutter-subtitle">
                Vyapaar Manager
              </div>
            </div>

            {/* Shutter bottom bar locks/handle */}
            <div className="shutter-bottom-bar">
              <div className="shutter-handle-left" />
              <div className="shutter-lock" />
              <div className="shutter-handle-right" />
            </div>
          </div>

          <style>{`
            .shop-shutter-overlay {
              position: fixed;
              top: 0;
              left: 0;
              width: 100vw;
              height: 100vh;
              z-index: 99999;
              background: #1f2937;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              transition: transform 1.6s cubic-bezier(0.77, 0, 0.175, 1);
              transform: translateY(0);
            }

            .shop-shutter-overlay.shutter-open {
              transform: translateY(-100%);
            }

            .shutter-body {
              position: relative;
              width: 100%;
              height: 100%;
              background: linear-gradient(to right, #4b5563 0%, #9ca3af 20%, #f3f4f6 50%, #9ca3af 80%, #4b5563 100%);
              border-bottom: 12px solid #111827;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              box-shadow: inset 0 0 100px rgba(0,0,0,0.5);
            }

            .shutter-segment {
              width: 100%;
              height: 4.16%;
              border-bottom: 2px solid #374151;
              box-shadow: inset 0 2px 2px rgba(255,255,255,0.2), 0 2px 5px rgba(0,0,0,0.3);
              pointer-events: none;
            }

            .shutter-board {
              position: absolute;
              background: #fffefb;
              border: 5px double #b91c1c;
              border-radius: 8px;
              padding: 2.25rem 4.5rem;
              text-align: center;
              box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
              max-width: 90%;
              animation: shutterFloat 3s ease-in-out infinite;
            }

            .shutter-blessing {
              font-size: 1.15rem;
              font-weight: 700;
              color: #b91c1c;
              margin-bottom: 0.75rem;
              letter-spacing: 0.5px;
            }

            .shutter-title {
              font-size: 3.75rem;
              font-weight: 900;
              color: #b91c1c;
              text-shadow: 2px 2px 0px #fecaca, 4px 4px 10px rgba(0,0,0,0.35);
              margin: 0;
              letter-spacing: 1px;
            }

            .shutter-subtitle {
              font-size: 1.15rem;
              font-weight: 700;
              color: #1e3a8a;
              text-transform: uppercase;
              letter-spacing: 4px;
              margin-top: 0.6rem;
            }

            .shutter-bottom-bar {
              position: absolute;
              bottom: 0;
              width: 100%;
              height: 48px;
              background: #111827;
              border-top: 3px solid #4b5563;
              display: flex;
              justify-content: center;
              align-items: center;
              gap: 4rem;
            }

            .shutter-handle-left, .shutter-handle-right {
              width: 90px;
              height: 14px;
              background: #9ca3af;
              border-radius: 6px;
              border: 3px solid #1f2937;
              box-shadow: inset 0 2px 4px rgba(255,255,255,0.3);
            }

            .shutter-lock {
              width: 28px;
              height: 28px;
              background: #d97706;
              border-radius: 50%;
              border: 4px solid #1f2937;
              box-shadow: inset 0 2px 4px rgba(255,255,255,0.3);
            }

            @keyframes shutterFloat {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-6px); }
              100% { transform: translateY(0px); }
            }
          `}</style>
        </div>
      )}
      <style>{`
        .sidebar-container {
          display: flex;
          min-height: 100vh;
          position: relative;
          width: 100%;
        }

        .mobile-header {
          display: none;
        }

        .sidebar-close-btn {
          display: none;
        }

        .app-sidebar {
          width: 260px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          padding: 1.5rem 1rem;
          flex-shrink: 0;
        }

        .app-main-content {
          flex: 1;
          overflow-y: auto;
          width: 100%;
          padding: 2rem;
        }

        @media (max-width: 768px) {
          .mobile-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 56px;
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            padding: 0 1rem;
            z-index: 998;
          }

          .menu-toggle-btn {
            background: none;
            border: none;
            color: var(--text-primary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.5rem;
          }

          .mobile-title {
            font-size: 1.1rem;
            font-weight: 700;
            color: var(--primary);
          }

          .sidebar-close-btn {
            display: flex;
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 0.25rem;
          }

          .app-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
            z-index: 1000;
            box-shadow: 4px 0 15px rgba(0,0,0,0.15);
            width: 260px;
          }

          .app-sidebar.open {
            transform: translateX(0);
          }

          .sidebar-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.4);
            z-index: 999;
            backdrop-filter: blur(2px);
          }

          .app-main-content {
            padding: 1rem;
            padding-top: 72px; /* Space for fixed mobile header */
          }
        }

        /* Theater Curtains styles */
        .theater-curtains-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          z-index: 9999;
          pointer-events: none;
        }

        .curtain-valance {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          background: linear-gradient(to bottom, #7f1d1d, #991b1b 50%, #7f1d1d 90%, #b45309 100%);
          box-shadow: 0 4px 10px rgba(0,0,0,0.4);
          z-index: 10000;
          border-bottom: 4px solid #d97706;
        }

        .curtain-panel {
          width: 50%;
          height: 100%;
          background: linear-gradient(to right, #991b1b, #7f1d1d 30%, #b91c1c 70%, #991b1b 100%);
          box-shadow: inset 0 0 80px rgba(0,0,0,0.8);
          transition: transform 1.2s cubic-bezier(0.77, 0, 0.175, 1);
          position: relative;
        }

        .curtain-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: repeating-linear-gradient(90deg, transparent, transparent 35px, rgba(0, 0, 0, 0.18) 40px, rgba(0, 0, 0, 0.18) 45px);
        }

        /* Gold tassels/border at the bottom and edge of curtains */
        .curtain-panel::after {
          content: '';
          position: absolute;
          bottom: 0;
          width: 100%;
          height: 25px;
          background: repeating-linear-gradient(90deg, #d97706, #d97706 10px, #b45309 10px, #b45309 20px);
          box-shadow: 0 -2px 10px rgba(0,0,0,0.3);
        }

        .left-curtain {
          transform: translateX(0);
          border-right: 6px solid #d97706; /* Gold borders */
        }

        .left-curtain.curtain-open {
          transform: translateX(-82%);
        }

        .right-curtain {
          transform: translateX(0);
          border-left: 6px solid #d97706; /* Gold borders */
        }

        .right-curtain.curtain-open {
          transform: translateX(82%);
        }
      `}</style>
    </div>
  );
}

export default App;
