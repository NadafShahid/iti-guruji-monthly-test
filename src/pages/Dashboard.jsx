import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db, allDbs } from '../firebase';
import { ref, get } from 'firebase/database';
import { BookOpen, Search, User, FileText, ChevronRight } from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Sanitize for Firebase paths (replace spaces with underscores to match Teacher App logic)
  const sanitize = (val) => String(val || '').replace(/ /g, '_').trim();

  // Robust parameter extraction
  const getParam = (key) => {
    const search = location.search || window.location.search;
    const val = new URLSearchParams(search).get(key);
    return val && val.trim() !== '' ? val.trim() : null;
  };

  const tradeParam = getParam('trade');
  const yearParam = getParam('year');
  const regnoParam = getParam('regno');
  const phoneParam = getParam('phone');

  useEffect(() => {
    const addTestToList = (testData, testId, list, parentTrade, parentYear) => {
        const mobile = testData.creatorMob || testData.createdBy;
        if (mobile && (testData.testId || testId)) {
            // Priority: Internal data -> Parent grouping key
            const trade = testData.trade || parentTrade;
            const year = testData.year || parentYear;
            
            // Generate slug if not present
            const safeName = (testData.testTitle || testData.subject || 'Test').toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const safeId = String(testData.testId || testId).replace(/[^a-z0-9]/g, '');
            const defaultSlug = `${safeName}-${safeId}`;
            const slug = testData.slug || defaultSlug;

            list.push({
              id: testData.testId || testId,
              name: testData.testTitle || `${testData.subject || 'Test'}`,
              className: trade,
              subject: testData.subject || 'General',
              mobileNo: mobile,
              questionCount: testData.totalQuestions || 0,
              year: year,
              academicYear: testData.academicYear,
              path: `gurujismart/Users/${mobile}/MonthlyTests/${testData.testId || testId}`,
              slug: slug
            });
        }
    };

    const fetchTests = async () => {
      try {
        const loadedTests = [];
        const seenTestKeys = new Set();

        for (const database of allDbs) {
          try {
            const testsRef = ref(database, 'gurujismart/MonthlyTestIndex');
            const snapshot = await get(testsRef);
            
            if (snapshot.exists()) {
              const data = snapshot.val();
              
              Object.keys(data || {}).forEach(tradeKey => {
                const tradeData = data[tradeKey];
                if (!tradeData || typeof tradeData !== 'object') return; // Safety check
                Object.keys(tradeData).forEach(key2 => {
                  const item2 = tradeData[key2];
                  
                  if (item2 && (item2.testId || item2.creatorMob || item2.createdBy)) {
                    const uniqueKey = `${item2.testId || key2}_${item2.creatorMob || item2.createdBy}`;
                    if (!seenTestKeys.has(uniqueKey)) {
                      seenTestKeys.add(uniqueKey);
                      addTestToList(item2, key2, loadedTests, tradeKey, null);
                    }
                  } else if (item2 && typeof item2 === 'object') {
                    Object.keys(item2).forEach(testId => {
                      const testData = item2[testId];
                      if (testData && typeof testData === 'object') {
                        const uniqueKey = `${testData.testId || testId}_${testData.creatorMob || testData.createdBy}`;
                        if (!seenTestKeys.has(uniqueKey)) {
                          seenTestKeys.add(uniqueKey);
                          addTestToList(testData, testId, loadedTests, tradeKey, key2);
                        }
                      }
                    });
                  }
                });
              });
            }
          } catch (dbErr) {
            console.warn("Error fetching tests from one database instance", dbErr);
          }
        }
        setTests(loadedTests);
      } catch (error) {
        console.error("Error fetching tests", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTests();
  }, []);

  const filteredTests = tests.filter(test => {
    // Helper to normalize strings (remove spaces, underscores and convert to lowercase)
    const normalize = (val) => String(val || '').toLowerCase().replace(/[\s_]/g, '').trim();

    // 1. Mandatory filters from Query Params
    if (tradeParam) {
        if (normalize(test.className) !== normalize(tradeParam)) return false;
    }
    
    if (yearParam) {
        if (normalize(test.year) !== normalize(yearParam)) return false;
    }

    // 2. Text Search filter
    if (!search) return true;
    const searchTerm = search.toLowerCase();
    return (
      (test.name && String(test.name).toLowerCase().includes(searchTerm)) || 
      (test.subject && String(test.subject).toLowerCase().includes(searchTerm)) ||
      (test.className && String(test.className).toLowerCase().includes(searchTerm)) ||
      (test.year && String(test.year).toLowerCase().includes(searchTerm))
    );
  });

  return (
    <div className="dashboard-container fade-in">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">
            {tradeParam ? `${tradeParam} Monthly Tests` : 'Available Exams'}
          </h1>
          <p className="dashboard-subtitle">
            {tradeParam 
              ? `Showing tests for ${tradeParam} ${yearParam ? `(${yearParam})` : ''}` 
              : 'Select a subject and test to start your exam evaluation.'}
          </p>
        </div>
        {(!tradeParam || tradeParam.trim() === '') && (
          <div className="search-bar">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by test, class, or subject..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading available exams...</p>
        </div>
      ) : filteredTests.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={48} className="empty-icon" />
          <h3>No tests found</h3>
          <p>
            {tradeParam 
              ? `No tests are currently available for ${tradeParam}.` 
              : 'Make sure you have added tests from the GuruJi Smart Android App first.'}
          </p>
        </div>
      ) : (
        <div className="tests-grid">
          {filteredTests.map((test) => (
            <div key={test.path} className="test-card card">
              <div className="test-badge">{test.subject}</div>
              <h2 className="test-name">{test.name}</h2>
              <div className="test-meta">
                <span><User size={16}/> {test.className} | {test.year}</span>
                <span><FileText size={16}/> {test.questionCount} Questions</span>
              </div>
              <button 
                className="btn btn-primary start-btn"
                onClick={() => {
                  const params = new URLSearchParams();
                  if (tradeParam) params.append('trade', tradeParam);
                  if (yearParam) params.append('year', yearParam);
                  if (regnoParam) params.append('regno', regnoParam);
                  if (phoneParam) params.append('phone', phoneParam);
                  const qString = params.toString();
                  navigate(`/test/${encodeURIComponent(test.slug)}${qString ? '?' + qString : ''}`);
                }}
              >
                Start Test <ChevronRight size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
