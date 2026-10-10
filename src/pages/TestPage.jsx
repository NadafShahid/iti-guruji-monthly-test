import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { db, allDbs, getFromAnyDb, saveToAllDbs } from '../firebase';
import { ref, get, set } from 'firebase/database';
import { Clock, ChevronLeft, ChevronRight, CheckCircle, PlayCircle, AlertCircle, BookOpen, ChevronRight as SidebarToggle } from 'lucide-react';
import './TestPage.css';

export default function TestPage() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);

  const [stage, setStage] = useState('loading'); // loading, instructions, testing, submitted, error, already_attempted, student_info
  const [testData, setTestData] = useState(null);
  const [testId, setTestId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [visitedQuestions, setVisitedQuestions] = useState({0: true});
  const [score, setScore] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

        for (const database of allDbs) {
          try {
            const indexRef = ref(database, 'gurujismart/MonthlyTestIndex');
            const snapshot = await get(indexRef);

            if (snapshot.exists()) {
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
                  return true;
                }

                for (const key of Object.keys(node)) {
                  if (searchIn(node[key], depth + 1)) return true;
                }
                return false;
              };

              if (searchIn(snapshot.val())) break;
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

        const testSnap = await getFromAnyDb(matchedPath);

        if (testSnap.exists()) {
          const data = testSnap.val();
          setTestId(matchedTestId);
          setTestData({ name: data.testTitle || 'Test', ...data });

          if (data && data.questions && typeof data.questions === 'object') {
            const qList = Object.keys(data.questions).map(key => {
              if (!data.questions[key] || typeof data.questions[key] !== 'object') return null;
              return { id: key, ...data.questions[key] };
            }).filter(q => q && q.question);

            qList.sort((a, b) => (a.questionNo || 0) - (b.questionNo || 0));
            setQuestions(qList);

            const durationMins = data.duration ? parseInt(data.duration) : 30;
            setTimeRemaining(durationMins * 60);
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
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [slug]);

  const handleStudentInfoSubmit = async (e) => {
    if (e) e.preventDefault();
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

    const safeRegno = studentInfo.regno.replace(/[.#$[\]]/g, '_');
    const resultSnap = await getFromAnyDb(`gurujismart/MonthlyTestResults/${testId}/${safeRegno}`);

    if (resultSnap.exists()) {
      setScore(resultSnap.val().score || 0);
      setStage('already_attempted');
    } else {
      setStage('instructions');
    }
  };

  // Timer countdown
  useEffect(() => {
    if (stage === 'testing' && timeRemaining !== null && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleSubmit(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage]);

  const formatTime = (seconds) => {
    if (seconds === null) return "--:--:--";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startTest = () => {
    setStage('testing');
  };

  const handleOptionSelect = (val) => {
    if (stage === 'testing') {
      setAnswers(prev => ({ ...prev, [currentQuestionIndex]: val }));
    }
  };

  const handleTextAnswer = (text) => {
    if (stage === 'testing') {
      setAnswers(prev => ({ ...prev, [currentQuestionIndex]: text }));
    }
  };

  const goToQuestion = (index) => {
    setVisitedQuestions(prev => ({ ...prev, [index]: true }));
    setCurrentQuestionIndex(index);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const next = currentQuestionIndex + 1;
      setVisitedQuestions(prev => ({ ...prev, [next]: true }));
      setCurrentQuestionIndex(next);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleMarkForReview = () => {
    setMarkedForReview(prev => ({
      ...prev,
      [currentQuestionIndex]: !prev[currentQuestionIndex]
    }));
    if (currentQuestionIndex < questions.length - 1) handleNext();
  };

  const handleClearResponse = () => {
    setAnswers(prev => {
      const updated = { ...prev };
      delete updated[currentQuestionIndex];
      return updated;
    });
  };

  const handleSubmit = async (isAutoSubmit = false) => {
    setStage('loading');
    if (timerRef.current) clearInterval(timerRef.current);

    let calculatedScore = 0;
    setAnswers(currentAnswers => {
      questions.forEach((q, index) => {
        const selected = currentAnswers[index];
        const correct = q.answer;
        if (q.section === "MCQ" || q.section === "True/False") {
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
          regno, phone, email, trade, year,
          score: calculatedScore,
          totalMarks: testData.totalMarks || questions.reduce((acc, q) => acc + (q.marks || 1), 0),
          submittedAt: new Date().toLocaleString(),
          testName: testData.testTitle || testData.name || 'Test',
          answers: currentAnswers
        };
        await saveToAllDbs(`gurujismart/MonthlyTestResults/${testId}/${safeRegno}`, resultData);
      }
    } catch (error) {
      console.error("ERROR: " + error.message);
    }

    setScore(calculatedScore);
    setStage('submitted');
  };

  // Get question palette status
  const getQuestionStatus = (index) => {
    const answered = answers[index] !== undefined && answers[index] !== '';
    const marked = markedForReview[index];
    const visited = visitedQuestions[index];

    if (answered && marked) return 'answered-marked';
    if (marked) return 'marked';
    if (answered) return 'answered';
    if (visited) return 'not-answered';
    return 'not-visited';
  };

  // Count stats
  const answeredCount = Object.values(answers).filter(v => v !== undefined && v !== '').length;
  const notAnsweredCount = Object.keys(visitedQuestions).filter(i => !answers[i]).length;
  const markedCount = Object.values(markedForReview).filter(Boolean).length;
  const answeredMarkedCount = Object.keys(markedForReview).filter(i => markedForReview[i] && answers[i]).length;
  const notVisitedCount = questions.length - Object.keys(visitedQuestions).length;

  /* ── STAGES ── */

  if (stage === 'loading') {
    return (
      <div className="exam-loading">
        <div className="exam-spinner"></div>
        <p>Loading Exam...</p>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className="exam-center-wrap">
        <div className="exam-card">
          <AlertCircle size={48} color="#ef4444" />
          <h3>Error Loading Exam</h3>
          <p>{errorMessage}</p>
          <button className="exam-btn exam-btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (stage === 'student_info') {
    return (
      <div className="exam-center-wrap">
        <div className="exam-card">
          <div className="exam-card-icon">
            <BookOpen size={36} color="#0284c7" />
          </div>
          <h2>Student Information</h2>
          <p className="exam-subtitle">Verify or enter your details to begin the exam session</p>

          <form onSubmit={handleStudentInfoSubmit} className="exam-form">
            <div className="exam-form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={studentInfo.email}
                className={formErrors.email ? 'error' : ''}
                onChange={(e) => { setStudentInfo({ ...studentInfo, email: e.target.value }); setFormErrors({ ...formErrors, email: null }); }}
              />
              {formErrors.email && <small>{formErrors.email}</small>}
            </div>
            <div className="exam-form-group">
              <label>Registration / PRN Number</label>
              <input
                type="text"
                placeholder="e.g. 102345"
                value={studentInfo.regno}
                className={formErrors.regno ? 'error' : ''}
                onChange={(e) => { setStudentInfo({ ...studentInfo, regno: e.target.value }); setFormErrors({ ...formErrors, regno: null }); }}
              />
              {formErrors.regno && <small>{formErrors.regno}</small>}
            </div>
            <div className="exam-form-group">
              <label>Mobile Number</label>
              <input
                type="tel"
                maxLength="10"
                placeholder="10 digit mobile number"
                value={studentInfo.phone}
                className={formErrors.phone ? 'error' : ''}
                onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); setStudentInfo({ ...studentInfo, phone: val }); setFormErrors({ ...formErrors, phone: null }); }}
              />
              {formErrors.phone && <small>{formErrors.phone}</small>}
            </div>
            <button type="submit" className="exam-btn exam-btn-primary">Proceed to Exam Instructions</button>
          </form>
        </div>
      </div>
    );
  }

  if (stage === 'already_attempted') {
    return (
      <div className="exam-center-wrap">
        <div className="exam-card">
          <BookOpen size={64} color="#f59e0b" />
          <h2>Already Attempted!</h2>
          <p>You have already submitted this exam with registration number: <strong>{studentInfo.regno}</strong>.</p>
          <div className="exam-score-board">
            <span className="exam-score-label">Previous Score</span>
            <span className="exam-score-value">{score}</span>
          </div>
          <button className="exam-btn exam-btn-primary" onClick={() => navigate('/')}>Return to Dashboard</button>
        </div>
      </div>
    );
  }

  if (stage === 'instructions') {
    return (
      <div className="exam-center-wrap">
        <div className="exam-card exam-instructions-card">
          <span className="exam-badge">{testData?.subject || "Examination"}</span>
          <h2>{testData?.name}</h2>
          <p className="exam-subtitle">Trade: <strong>{testData?.trade || searchParams.get('trade') || "General"}</strong> • Year: <strong>{testData?.year || searchParams.get('year') || "All"}</strong></p>

          <div className="exam-guidelines">
            <h3>📋 Exam Guidelines &amp; Rules:</h3>
            <ul>
              <li>Ensure you have a stable internet connection before clicking start.</li>
              <li>The exam consists of <strong>{questions.length} questions</strong> total.</li>
              <li>Total duration allocated: <strong>{Math.floor((timeRemaining || 0) / 60)} minutes</strong>.</li>
              <li>A real-time countdown timer will remain visible at the top during the exam.</li>
              <li>Once the timer expires, your answers are <strong>automatically submitted</strong>.</li>
              <li>Do not close the application or press back while the exam is in progress.</li>
              <li>Objective questions (MCQ &amp; True/False) are auto-graded immediately upon submission.</li>
            </ul>
          </div>

          <button className="exam-btn exam-btn-primary exam-btn-start" onClick={startTest}>
            <PlayCircle size={22} /> Start Exam Now
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'submitted') {
    return (
      <div className="exam-center-wrap">
        <div className="exam-card">
          <CheckCircle size={64} color="#10b981" />
          <h2>Exam Submitted Successfully!</h2>
          <div className="exam-score-board">
            <span className="exam-score-label">Your Auto-Score</span>
            <span className="exam-score-value">{score} <small>/ {testData?.totalMarks || questions.length}</small></span>
          </div>
          <p className="exam-subtitle">Note: Theory and One-Line answers will need manual evaluation by your instructor.</p>
        </div>
      </div>
    );
  }

  /* ── TESTING STAGE (AcadLix-style UI) ── */
  if (stage === 'testing') {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return null;

    const mcqOptions = [
      { key: 'A', text: currentQuestion.optA },
      { key: 'B', text: currentQuestion.optB },
      { key: 'C', text: currentQuestion.optC },
      { key: 'D', text: currentQuestion.optD }
    ];

    const tfOptions = [
      { key: 'True', text: 'True' },
      { key: 'False', text: 'False' }
    ];

    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const timerWarning = timeRemaining !== null && timeRemaining < 300;

    return (
      <div className="ep-wrapper">
        {/* ── TOP HEADER ── */}
        <header className="ep-header">
          <div className="ep-header-left">
            <div className="ep-logo">📚 ITI Guruji Exam</div>
            <div className="ep-exam-name">{testData?.name}</div>
          </div>
          <div className="ep-header-right">
            <div className={`ep-timer ${timerWarning ? 'ep-timer-warning' : ''}`}>
              <Clock size={16} />
              Time Left: {formatTime(timeRemaining)}
            </div>
            <div className="ep-student-name">
              👤 {studentInfo.phone || studentInfo.regno || 'Student'}
            </div>
          </div>
        </header>

        {/* ── SECTION TABS ── */}
        <div className="ep-sections-bar">
          <span className="ep-section-tab ep-section-active">
            {testData?.subject || 'General'}
          </span>
          <button className="ep-view-instruction">View Instruction</button>
        </div>

        {/* ── MAIN BODY ── */}
        <div className="ep-body">
          {/* LEFT: Question Panel */}
          <div className="ep-question-panel">
            <div className="ep-q-meta">
              <span>Question Type: <strong>Single Choice Question</strong></span>
            </div>

            <div className="ep-q-number">Question No. {currentQuestion.questionNo || currentQuestionIndex + 1}</div>

            <div className="ep-q-text">{currentQuestion.question}</div>

            {currentQuestion.questionImage && (
              <div className="ep-q-image-wrap">
                <img src={`data:image/jpeg;base64,${currentQuestion.questionImage}`} alt={`Q${currentQuestion.questionNo}`} />
              </div>
            )}

            <div className="ep-options">
              {currentQuestion.section === "MCQ" && mcqOptions.map(opt =>
                valText(opt.text) && (
                  <label
                    key={opt.key}
                    className={`ep-option ${answers[currentQuestionIndex] === opt.key ? 'ep-option-selected' : ''}`}
                    onClick={() => handleOptionSelect(opt.key)}
                  >
                    <span className="ep-option-radio">
                      {answers[currentQuestionIndex] === opt.key
                        ? <span className="ep-radio-filled"></span>
                        : <span className="ep-radio-empty"></span>
                      }
                    </span>
                    <span className="ep-option-text">{opt.text}</span>
                  </label>
                )
              )}

              {currentQuestion.section === "True/False" && tfOptions.map(opt => (
                <label
                  key={opt.key}
                  className={`ep-option ${answers[currentQuestionIndex] === opt.key ? 'ep-option-selected' : ''}`}
                  onClick={() => handleOptionSelect(opt.key)}
                >
                  <span className="ep-option-radio">
                    {answers[currentQuestionIndex] === opt.key
                      ? <span className="ep-radio-filled"></span>
                      : <span className="ep-radio-empty"></span>
                    }
                  </span>
                  <span className="ep-option-text">{opt.text}</span>
                </label>
              ))}

              {(currentQuestion.section === "One Line Answer" || currentQuestion.section === "Theory / Long Answer") && (
                <textarea
                  className="ep-textarea"
                  placeholder="Type your answer here..."
                  value={answers[currentQuestionIndex] || ""}
                  onChange={(e) => handleTextAnswer(e.target.value)}
                  rows={currentQuestion.section === "Theory / Long Answer" ? 6 : 3}
                />
              )}
            </div>
          </div>

          {/* RIGHT: Sidebar */}
          <div className={`ep-sidebar ${sidebarOpen ? '' : 'ep-sidebar-collapsed'}`}>
            <button className="ep-sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
              <ChevronRight size={16} style={{ transform: sidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.3s' }} />
            </button>

            {sidebarOpen && (
              <>
                {/* Legend */}
                <div className="ep-legend">
                  <div className="ep-legend-item">
                    <span className="ep-dot ep-dot-answered">{answeredCount}</span>
                    <span>Answered</span>
                    <span className="ep-dot ep-dot-not-answered">{notAnsweredCount}</span>
                    <span>Not Answered</span>
                  </div>
                  <div className="ep-legend-item">
                    <span className="ep-dot ep-dot-not-visited">{notVisitedCount}</span>
                    <span>Not Visited</span>
                    <span className="ep-dot ep-dot-marked">{markedCount}</span>
                    <span>Marked for Review</span>
                  </div>
                  <div className="ep-legend-item-full">
                    <span className="ep-dot ep-dot-answered-marked">{answeredMarkedCount}</span>
                    <span>Answered and Marked for Review (will be considered for evaluation)</span>
                  </div>
                </div>

                {/* Question Palette */}
                <div className="ep-palette-header">
                  <span>{testData?.subject || 'General'}</span>
                  <span>Choose a Question</span>
                </div>
                <div className="ep-palette">
                  {questions.map((_, index) => (
                    <button
                      key={index}
                      className={`ep-palette-btn ep-palette-${getQuestionStatus(index)} ${index === currentQuestionIndex ? 'ep-palette-current' : ''}`}
                      onClick={() => goToQuestion(index)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── BOTTOM NAVIGATION ── */}
        <footer className="ep-footer">
          <div className="ep-footer-left">
            <button className="ep-btn ep-btn-outline" onClick={handleMarkForReview}>
              Mark for Review &amp; Next
            </button>
            <button className="ep-btn ep-btn-ghost" onClick={handleClearResponse}>
              Clear Response
            </button>
          </div>
          <div className="ep-footer-right">
            <button className="ep-btn ep-btn-outline" onClick={handlePrev} disabled={currentQuestionIndex === 0}>
              Previous
            </button>
            {isLastQuestion ? (
              <button className="ep-btn ep-btn-submit" onClick={() => handleSubmit(false)}>
                Submit
              </button>
            ) : (
              <button className="ep-btn ep-btn-primary" onClick={handleNext}>
                Save &amp; Next
              </button>
            )}
            <button className="ep-btn ep-btn-submit" onClick={() => handleSubmit(false)}>
              Submit
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return null;
}

function valText(txt) {
  return txt && txt.trim() !== "";
}
