import React, { Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TestPage from './pages/TestPage';
import CollegePage from './pages/CollegePage';
import { BookOpen } from 'lucide-react';
import './App.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2>Oops! Something went wrong.</h2>
          <p>We're sorry, but the application encountered an error.</p>
          <p style={{ color: 'red', marginTop: '1rem', wordBreak: 'break-word' }}>
            {this.state.error?.toString()}
          </p>
          <button 
            onClick={() => window.location.href = '/'} 
            style={{ padding: '0.8rem 1.5rem', marginTop: '2rem', cursor: 'pointer', backgroundColor: '#06b6d4', color: 'white', border: 'none', borderRadius: '8px' }}>
            Restart Website
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const location = useLocation();

  
  // Robust parameter extraction (checks React Router location then window.location as fallback)
  const getParam = (key) => {
    const search = location.search || window.location.search;
    return new URLSearchParams(search).get(key);
  };

  const tradeParam = getParam('trade');
  const yearParam = getParam('year');

  // Construct the home link with params if they exist
  const homePath = tradeParam 
    ? `/?trade=${encodeURIComponent(tradeParam)}${yearParam ? `&year=${encodeURIComponent(yearParam)}` : ''}`
    : '/';

  return (
    <div className="app-container">
      <nav className="navbar">
        <Link to={homePath} className="navbar-brand">
          <BookOpen size={28} />
           ITI Guruji Exam
        </Link>
        <div className="navbar-actions">
           {!tradeParam && <Link to="/" className="btn btn-secondary">Dashboard</Link>}
        </div>
      </nav>
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/test/:slug" element={<TestPage />} />
          <Route path="/college/:slug" element={<CollegePage />} />
          <Route path="/:slug" element={<CollegePage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
