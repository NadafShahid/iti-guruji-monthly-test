import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { db, allDbs, getFromAnyDb, saveToAllDbs } from '../firebase';
import { ref, get, set } from 'firebase/database';
import { Clock, ChevronLeft, ChevronRight, CheckCircle, ArrowLeft, PlayCircle, AlertCircle, BookOpen } from 'lucide-react';
import './TestPage.css';

export default function TestPage() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  
  const [stage, setStage] = useState('loading'); // loading, instructions, testing, submitted, error, already_attempted
  const [testData, setTestData] = useState(null);
  const [testId, setTestId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Timer State
  const [timeRemaining, setTimeRemaining] = useState(null);
  const timerRef = useRef(null);

  const [studentInfo, setStudentInfo] = useState({
    email: '',
    regno: searchParams.get('regno') || '',
    phone: searchParams.get('phone') || ''
  });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (!slug) {
      navigate('/');
      return;
    }

    const initTest = async () => {
      try {
        let matchedPath = null;
        let matchedTestId = null;

        // Step 1: Find test path by slug across all connected Firebase databases
        for (const database of allDbs) {
          try {
            const indexRef = ref(database, 'gurujismart/MonthlyTestIndex');
            const snapshot = await get(indexRef);

            if (snapshot.exists()) {
              console.log(`URL Slug to match: "${slug}"`);

              const searchIn = (node, depth = 0) => {
                if (!node || typeof node !== 'object') return;

                const variations = [
                  node.testTitle,
                  node.subject ? (node.subject + " Test") : null,
                  node.subject
                ].filter(v => v != null && v !== "");

                let isMatch = false;
                const safeId = String(node.testId || "unknown").toLowerCase().replace(/[^a-z0-9]/g, "");
                const urlSlug = slug ? slug.toLowerCase() : "";

                for (const rawName of variations) {
                  const safeName = rawName.trim().toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "");

                  const generatedSlug = `${safeName}-${safeId}`;
                  if (generatedSlug === urlSlug || node.slug === urlSlug) {
                    isMatch = true;
                    break;
                  }
                }

                if (isMatch) {
                  const mobile = node.creatorMob || node.createdBy;
                  matchedPath = `gurujismart/Users/${mobile}/MonthlyTests/${node.testId}`;
                  matchedTestId = node.testId;
                  console.log(`MATCH FOUND! Path: ${matchedPath}`);
                  return true;
                }

                for (const key of Object.keys(node)) {
                  if (searchIn(node[key], depth + 1)) return true;
                }
                return false;
              };

              if (searchIn(snapshot.val())) {
                break;
              }
            }
          } catch (e) {
            console.warn("Error searching database for slug:", e);
          }
        }

        if (!matchedPath) {
          setErrorMessage("Exam not found or the link is invalid.");
          setStage('error');
          return;
        }

        // Step 2: Fetch Test Data across databases
        const testSnap = await getFromAnyDb(matchedPath);

        if (testSnap.exists()) {
          const data = testSnap.val();
          setTestId(matchedTestId);
          setTestData({
            name: data.testTitle || 'Test',
            ...data
          });

          if (data && data.questions && typeof data.questions === 'object') {
            const qList = Object.keys(data.questions).map(key => {
              if(!data.questions[key] || typeof data.questions[key] !== 'object') return null;
              return { id: key, ...data.questions[key] };
            }).filter(q => q && q.question);
            
            qList.sort((a,b) => (a.questionNo || 0) - (b.questionNo || 0));
            setQuestions(qList);
            
            // Set Timer (default to 30 mins)
            const durationMins = data.duration ? parseInt(data.duration) : 30;
            setTimeRemaining(durationMins * 60);

            // GO TO STUDENT INFO FIRST
            setStage('student_info');
          } else {
             setErrorMessage("No questions found in this exam.");
             setStage('error');
          }
        } else {
           setErrorMessage("Exam details could not be loaded.");
           setStage('error');
        }

      } catch (error) {
        console.error("Error initializing test", error);
        setErrorMessage(error.message);
        setStage('error');
      }
    };

    initTest();
    
    return () => {
        if(timerRef.current) clearInterval(timerRef.current);
    }
  }, [slug]);

  const handleStudentInfoSubmit = async (e) => {
    if(e) e.preventDefault();
    const errors = {};
    if (!studentInfo.email) errors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(studentInfo.email)) errors.email = "Invalid email format";
    if (!studentInfo.regno) errors.regno = "Registration number is required";
    if (!studentInfo.phone) errors.phone = "Phone number is required";
    else if (!/^\d{10}$/.test(studentInfo.phone)) errors.phone = "Phone number must be exactly 10 digits";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setStage('loading');
    
    // Check if Already Attempted with the provided Registration Number
    const safeRegno = studentInfo.regno.replace(/[.#$[\]]/g, '_');
    const resultSnap = await getFromAnyDb(`gurujismart/MonthlyTestResults/${testId}/${safeRegno}`);
    
    if (resultSnap.exists()) {
        setScore(resultSnap.val().score || 0);
        setStage('already_attempted');
    } else {
        setStage('instructions');
    }
  };

  // Timer countdown hook
  useEffect(() => {
     if (stage === 'testing' && timeRemaining !== null && timeRemaining > 0) {
        timerRef.current = setInterval(() => {
           setTimeRemaining(prev => {
              if (prev <= 1) {
                 clearInterval(timerRef.current);
                 // Auto submit using a ref or direct function call
                 handleSubmit(true); 
                 return 0;
              }
              return prev - 1;
           });
        }, 1000);
     }
     return () => {
         if(timerRef.current) clearInterval(timerRef.current);
     };
  }, [stage, timeRemaining]); // Depend on stage to start it properly

  const formatTime = (seconds) => {
     if (seconds === null) return "--:--";
     const m = Math.floor(seconds / 60);
     const s = seconds % 60;
     return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startTest = () => {
     setStage('testing');
  };

  const handleOptionSelect = (val) => {
    if (stage === 'testing') {
      setAnswers(prev => ({...prev, [currentQuestionIndex]: val}));
    }
  };

  const handleTextAnswer = (text) => {
    if (stage === 'testing') {
      setAnswers(prev => ({...prev, [currentQuestionIndex]: text}));
    }
  }

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async (isAutoSubmit = false) => {
    console.log(`handleSubmit started! AutoSubmit: ${isAutoSubmit}`);
    setStage('loading'); // Show loading while saving
    
    if(timerRef.current) clearInterval(timerRef.current);

    let calculatedScore = 0;
    // We must use the latest state directly in this closure. 
    // Since handleSubmit might be called from interval, answers might be stale if we're not careful.
    // React state in intervals is tricky, using the functional state for answers wasn't done for calculatedScore, 
    // but we can trust the current render cycle values for explicit clicks, and the latest functional approach.
    setAnswers(currentAnswers => {
        questions.forEach((q, index) => {
          const selected = currentAnswers[index];
          const correct = q.answer;
          if(q.section === "MCQ" || q.section === "True/False"){
            if (selected === correct) {
                calculatedScore += (q.marks || 1);
            }
          }
        });
        
        saveResultToFirebase(calculatedScore, currentAnswers);
        return currentAnswers;
    });
  };

  const saveResultToFirebase = async (calculatedScore, currentAnswers) => {
    const { regno, phone, email } = studentInfo;
    const trade = searchParams.get('trade') || testData.trade || '';
    const year = searchParams.get('year') || testData.year || '';
    
    const safeRegno = regno.replace(/[.#$[\]]/g, '_');

    try {
      if (testId && safeRegno) {
          const resultData = {
            regno,
            phone,
            email,
            trade,
            year,
            score: calculatedScore,
            totalMarks: testData.totalMarks || questions.reduce((acc, q) => acc + (q.marks || 1), 0),
            submittedAt: new Date().toLocaleString(),
            testName: testData.testTitle || testData.name || 'Test',
            answers: currentAnswers
          };

          await saveToAllDbs(`gurujismart/MonthlyTestResults/${testId}/${safeRegno}`, resultData);
          console.log("SUCCESS: Result saved to all Firebase databases.");
      }
    } catch (error) {
      console.error("ERROR: " + error.message);
      alert("Error saving result: " + error.message);
    }

    setScore(calculatedScore);
    setStage('submitted');
  };

  let mainContent;

  if (stage === 'loading') {
    mainContent = (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading Exam...</p>
      </div>
    );
  } else if (stage === 'error') {
    mainContent = (
      <div className="empty-state">
        <AlertCircle size={48} className="empty-icon text-red-500" />
        <h3>Error Loading Exam</h3>
        <p>{errorMessage}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
      </div>
    );
  } else if (stage === 'student_info') {
    mainContent = (
      <div className="instructions-container fade-in" style={{maxWidth: "520px", margin: "1rem auto", padding: "1rem"}}>
        <div className="card test-instruction-card" style={{boxShadow: "0 12px 32px -4px rgba(15, 23, 42, 0.12)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)"}}>
           <div style={{textAlign: 'center', marginBottom: '2rem'}}>
              <div style={{width: "72px", height: "72px", margin: "0 auto 1.25rem", background: "linear-gradient(135deg, rgba(2, 132, 199, 0.1) 0%, rgba(13, 148, 136, 0.15) 100%)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid rgba(2, 132, 199, 0.25)"}}>
                <BookOpen size={36} color="var(--primary)" />
              </div>
              <h2 style={{fontSize: '1.65rem', fontWeight: '800', letterSpacing: '-0.02em', color: "var(--text-dark)"}}>Student Information</h2>
              <p style={{color: 'var(--text-light)', fontSize: "0.95rem", marginTop: "0.25rem"}}>Verify or enter your details to begin the exam session</p>
           </div>

           <form onSubmit={handleStudentInfoSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1.35rem'}}>
              <div className="form-group">
                <label style={{display: 'block', marginBottom: '0.45rem', fontSize: '0.9rem', fontWeight: '600', color: "var(--text-medium)"}}>Email Address</label>
                <input 
                  type="email" 
                  className={`form-control ${formErrors.email ? 'border-red-500' : ''}`}
                  placeholder="name@example.com"
                  value={studentInfo.email}
                  onChange={(e) => {
                    setStudentInfo({...studentInfo, email: e.target.value});
                    setFormErrors({...formErrors, email: null});
                  }}
                  style={{width: '100%', padding: '0.9rem 1.15rem', borderRadius: '12px', border: '1.5px solid var(--border)', fontSize: '0.95rem', outline: 'none', transition: 'border 0.2s', background: "var(--background)", color: "var(--text-dark)"}}
                />
                {formErrors.email && <small className="text-red-500" style={{fontSize: '0.8rem', marginTop: '0.35rem', display: 'block'}}>{formErrors.email}</small>}
              </div>

              <div className="form-group">
                <label style={{display: 'block', marginBottom: '0.45rem', fontSize: '0.9rem', fontWeight: '600', color: "var(--text-medium)"}}>Registration / PRN Number</label>
                <input 
                  type="text" 
                  className={`form-control ${formErrors.regno ? 'border-red-500' : ''}`}
                  placeholder="e.g. 102345"
                  value={studentInfo.regno}
                  onChange={(e) => {
                    setStudentInfo({...studentInfo, regno: e.target.value});
                    setFormErrors({...formErrors, regno: null});
                  }}
                  style={{width: '100%', padding: '0.9rem 1.15rem', borderRadius: '12px', border: '1.5px solid var(--border)', fontSize: '0.95rem', outline: 'none', transition: 'border 0.2s', background: "var(--background)", color: "var(--text-dark)"}}
                />
                {formErrors.regno && <small className="text-red-500" style={{fontSize: '0.8rem', marginTop: '0.35rem', display: 'block'}}>{formErrors.regno}</small>}
              </div>

              <div className="form-group">
                <label style={{display: 'block', marginBottom: '0.45rem', fontSize: '0.9rem', fontWeight: '600', color: "var(--text-medium)"}}>Mobile Number</label>
                <input 
                  type="tel" 
                  maxLength="10"
                  className={`form-control ${formErrors.phone ? 'border-red-500' : ''}`}
                  placeholder="10 digit mobile number"
                  value={studentInfo.phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setStudentInfo({...studentInfo, phone: val});
                    setFormErrors({...formErrors, phone: null});
                  }}
                  style={{width: '100%', padding: '0.9rem 1.15rem', borderRadius: '12px', border: '1.5px solid var(--border)', fontSize: '0.95rem', outline: 'none', transition: 'border 0.2s', background: "var(--background)", color: "var(--text-dark)"}}
                />
                {formErrors.phone && <small className="text-red-500" style={{fontSize: '0.8rem', marginTop: '0.35rem', display: 'block'}}>{formErrors.phone}</small>}
              </div>

              <button type="submit" className="btn btn-primary" style={{marginTop: '0.75rem', padding: '1rem', fontWeight: '700', borderRadius: '12px', fontSize: '1.05rem', letterSpacing: '0.01em'}}>
                Proceed to Exam Instructions
              </button>
           </form>
        </div>
      </div>
    );
  } else if (stage === 'already_attempted') {
    mainContent = (
      <div className="result-container fade-in">
        <div className="result-card card">
          <BookOpen size={64} className="result-icon text-yellow-500" style={{color: "var(--accent)"}} />
          <h2 className="result-title">Already Attempted!</h2>
          <p className="score-feedback" style={{marginBottom: "1.5rem"}}>You have already submitted this exam with registration number: <strong>{studentInfo.regno}</strong>.</p>
          <div className="score-board">
            <span className="score-label">Previous Score</span>
            <span className="score-value">{score}</span>
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Return to Dashboard</button>
        </div>
      </div>
    );
  } else if (stage === 'instructions') {
    mainContent = (
      <div className="instructions-container fade-in" style={{maxWidth: "840px", margin: "1rem auto", padding: "1rem"}}>
        <div className="card test-instruction-card" style={{boxShadow: "0 12px 32px -4px rgba(15, 23, 42, 0.12)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)"}}>
           <div style={{textAlign: 'center', marginBottom: '2rem'}}>
             <span className="test-badge" style={{marginBottom: "0.75rem"}}>{testData?.subject || "Examination"}</span>
             <h2 className="test-title" style={{fontSize: '2.1rem', fontWeight: '800', letterSpacing: '-0.02em', marginTop: "0.25rem"}}>{testData?.name}</h2>
             <p className="test-subtitle" style={{marginTop: "0.35rem", fontSize: "1rem"}}>Trade: <strong>{testData?.trade || searchParams.get('trade') || "General"}</strong> • Year: <strong>{testData?.year || searchParams.get('year') || "All"}</strong></p>
           </div>
           
           <div className="instructions-content" style={{background: 'var(--border-light)', padding: '2rem', borderRadius: '16px', border: '1.5px solid var(--border)'}}>
              <h3 style={{fontSize: '1.25rem', marginBottom: '1.25rem', fontWeight: '700', color: "var(--text-dark)", display: "flex", alignItems: "center", gap: "0.5rem"}}>
                📋 Exam Guidelines &amp; Rules:
              </h3>
              <ul style={{listStyleType: 'disc', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', color: 'var(--text-medium)', fontSize: "0.98rem"}}>
                 <li>Ensure you have a stable internet connection before clicking start.</li>
                 <li>The exam consists of <strong>{questions.length} questions</strong> total.</li>
                 <li>Total duration allocated: <strong>{Math.floor(timeRemaining / 60)} minutes</strong>.</li>
                 <li>A real-time countdown timer will remain visible at the top during the exam.</li>
                 <li>Once the timer expires, your answers are <strong>automatically submitted</strong>.</li>
                 <li>Do not close the application or press back while the exam is in progress.</li>
                 <li>Objective questions (MCQ &amp; True/False) are auto-graded immediately upon submission.</li>
              </ul>
           </div>
           
           <div style={{display: 'flex', justifyContent: 'center', marginTop: '2.25rem'}}>
             <button className="btn btn-primary start-pulse" onClick={startTest} style={{padding: '1.1rem 3.5rem', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '14px', fontWeight: '700'}}>
               Start Exam Now <PlayCircle size={24} />
             </button>
           </div>
        </div>
      </div>
    );
  } else if (stage === 'submitted') {
    mainContent = (
      <div className="result-container fade-in">
        <div className="result-card card">
          <CheckCircle size={64} className="result-icon" />
          <h2 className="result-title">Exam Submitted Successfully!</h2>
          <div className="score-board">
            <span className="score-label">Your Auto-Score</span>
            <span className="score-value">{score} <small>/ {testData?.totalMarks || questions.length}</small></span>
          </div>
          <p className="score-feedback">
            Note: Theory and One-Line answers will need manual evaluation by your instructor.
          </p>
        </div>
      </div>
    );
  } else if (stage === 'testing') {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return null;

    // MCQ Options
    const mcqOptions = [
      { key: 'A', text: currentQuestion.optA },
      { key: 'B', text: currentQuestion.optB },
      { key: 'C', text: currentQuestion.optC },
      { key: 'D', text: currentQuestion.optD }
    ];

    // True/False options
    const tfOptions = [
        { key: 'True', text: 'True' },
        { key: 'False', text: 'False' }
    ];

    const currentQuestionIndex0Based = currentQuestionIndex + 1;

    mainContent = (
      <div className="test-container fade-in">
        <div className="test-header card" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div className="test-info">
            <div style={{ display: "flex", flexDirection: "column" }}>
              <h2 className="test-title" style={{fontSize: '1.3rem'}}>{testData?.name}</h2>
              <span className="test-subtitle" style={{fontSize: '0.9rem'}}>{testData?.subject}</span>
            </div>
          </div>
          <div className="test-meta" style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
            <div className={`timer-chip ${timeRemaining < 300 ? 'timer-warning' : ''}`}>
               <Clock size={19}/>
               {formatTime(timeRemaining)}
            </div>
            <div className="progress-chip">
              Q{currentQuestionIndex0Based} / {questions.length}
            </div>
          </div>
        </div>

        <div className="question-card card">
          <div className="question-header">
             <h3 className="question-text">
               <span className="q-number">Q{currentQuestion.questionNo || currentQuestionIndex0Based}.</span> {currentQuestion.question}
             </h3>
             <span className="question-marks">[{currentQuestion.marks} Marks]</span>
          </div>

          {currentQuestion.questionImage && (
               <div className="question-image-container">
                   <img src={`data:image/jpeg;base64,${currentQuestion.questionImage}`} alt={`Question ${currentQuestion.questionNo}`} className="question-image"/>
               </div>
          )}

          <div className="options-container">
              {currentQuestion.section === "MCQ" && (
                  <div className="options-grid">
                    {mcqOptions.map((option) => (
                      valText(option.text) && (
                        <button 
                          key={option.key}
                          className={`option-btn ${answers[currentQuestionIndex] === option.key ? 'selected' : ''}`}
                          onClick={() => handleOptionSelect(option.key)}
                        >
                          <span className="option-label">{option.key}</span>
                          <span className="option-text">{option.text}</span>
                        </button>
                      )
                    ))}
                  </div>
              )}

              {currentQuestion.section === "True/False" && (
                  <div className="options-grid">
                    {tfOptions.map((option) => (
                        <button 
                          key={option.key}
                          className={`option-btn tf-btn ${answers[currentQuestionIndex] === option.key ? 'selected' : ''}`}
                          onClick={() => handleOptionSelect(option.key)}
                        >
                          <span className="option-text" style={{textAlign: "center", width: "100%"}}>{option.text}</span>
                        </button>
                    ))}
                  </div>
              )}

              {(currentQuestion.section === "One Line Answer" || currentQuestion.section === "Theory / Long Answer") && (
                  <div className="text-answer-container">
                      <textarea 
                          className="text-answer-input"
                          placeholder="Type your answer here..."
                          value={answers[currentQuestionIndex] || ""}
                          onChange={(e) => handleTextAnswer(e.target.value)}
                          rows={currentQuestion.section === "Theory / Long Answer" ? 6 : 2}
                      />
                  </div>
              )}
          </div>
        </div>

        <div className="test-navigation card">
          <button 
            className="btn btn-outline" 
            onClick={handlePrev} 
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft size={18} /> Previous
          </button>

          {currentQuestionIndex === questions.length - 1 ? (
            <button className="btn btn-primary submit-pulse" onClick={() => handleSubmit(false)}>
              Submit Exam <CheckCircle size={18} />
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleNext}>
              Next <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="test-page-wrapper">
      {mainContent}
    </div>
  );
}

// helper to exclude empty options
function valText(txt) {
  return txt && txt.trim() !== "";
}
