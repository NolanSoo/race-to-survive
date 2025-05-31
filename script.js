// placeholders for encryption functions (simple base64 for demo)
function encrypt(text) {
  return btoa(text); // encode to base64
}
function decrypt(data) {
  return atob(data); // decode base64
}

// mock AI question generator
function generateQuestions(topic, notes, numQuestions, mcPercent) {
  const questions = [];
  const mcCount = Math.round((mcPercent / 100) * numQuestions);
  const shortCount = numQuestions - mcCount;
  for (let i = 0; i < mcCount; i++) {
    questions.push({
      id: `mc-${i}`,
      type: 'multiple-choice',
      question: `sample mc question ${i + 1} on ${topic}`,
      options: generateOptions(),
      answer: null,
    });
  }
  for (let i = 0; i < shortCount; i++) {
    questions.push({
      id: `sc-${i}`,
      type: 'short-answer',
      question: `sample short answer question ${i + 1} on ${topic}`,
      answer: null,
    });
  }
  // shuffling questions
  return questions.sort(() => Math.random() - 0.5);
}

function generateOptions() {
  const options = [
    { text: 'option a', points: 2 },
    { text: 'option b', points: 3 },
    { text: 'option c', points: 4 },
    { text: 'option d', points: 1 },
    { text: 'option e', points: 0 },
  ];
  // shuffle options
  return options.sort(() => Math.random() - 0.5);
}

// game vars
let questions = [];
let currentQuestionIndex = 0;
let totalPointsPossible = 0;
let earnedPoints = 0;
let questionStartTime = 0;
let questionTimer = null;

const gradeThresholds = {
  passPercent: 80,
  rawPercent: 75,
}

// gamification stuff
const powerUps = {
  redemptionArc: false,
  doubleJeopardy: false,
  fiftyFifty: false,
  hint: false,
}

const stats = {
  correctAnswers: 0,
  totalQuestions: 0,
  pointsEarned: 0,
  rawPoints: 0,
  partialCredits: 0,
}

// dom elements
const startBtn = document.getElementById('startBtn');
const questionSection = document.getElementById('questionSection');
const questionCountElem = document.getElementById('questionCount');
const questionContainer = document.getElementById('questionContainer');
const timerElem = document.getElementById('timer');
const nextBtn = document.getElementById('nextBtn');
const feedbackDiv = document.getElementById('feedback');

const resultsSection = document.getElementById('resultsSection');
const scoreSummary = document.getElementById('scoreSummary');
const restartBtn = document.getElementById('restartBtn');
const recommendationsDiv = document.getElementById('recommendations');

let currentQuestion = null;
let questionTimeout = null;

// event listeners
startBtn.addEventListener('click', startSession);
nextBtn.addEventListener('click', loadNextQuestion);
restartBtn.addEventListener('click', resetSession);

// start session
function startSession() {
  // reset stats
  Object.assign(stats, {
    correctAnswers: 0,
    totalQuestions: 0,
    pointsEarned: 0,
    rawPoints: 0,
  });
  // reset powerups
  powerUps.redemptionArc = false;
  powerUps.doubleJeopardy = false;
  powerUps.fiftyFifty = false;
  powerUps.hint = false;

  // get inputs
  const topicTitle = document.getElementById('topicTitle').value.trim() || 'untitled';
  const topicNotes = document.getElementById('topicNotes').value.trim() || '';
  const numQuestions = parseInt(document.getElementById('numQuestions').value) || 25;
  const mcPercentStr = document.getElementById('questionTypePercent').value;
  const mcPercent = parseInt(mcPercentStr.split(',')[0]);
  // generate questions
  questions = generateQuestions(topicTitle, topicNotes, numQuestions, mcPercent);
  totalPointsPossible = questions.reduce((acc, q) => {
    if (q.type === 'multiple-choice') {
      return acc + 10;
    } else {
      return acc + 18;
    }
  }, 0);
  // start first question
  currentQuestionIndex = 0;
  document.querySelector('.setup-section').classList.add('hidden');
  resultsSection.classList.add('hidden');
  questionSection.classList.remove('hidden');
  loadQuestion();
}

// load question
function loadQuestion() {
  clearTimeout(questionTimeout);
  feedbackDiv.innerHTML = '';
  nextBtn.classList.add('hidden');

  currentQuestion = questions[currentQuestionIndex];
  questionCountElem.textContent = `question ${currentQuestionIndex + 1} of ${questions.length}`;

  // show question
  let html = `<p>${currentQuestion.question}</p>`;
  if (currentQuestion.type === 'multiple-choice') {
    html += '<div class="options">';
    currentQuestion.options.forEach((opt, idx) => {
      html += `<button class="option-btn" data-index="${idx}">${opt.text}</button>`;
    });
    html += '</div>';
  } else {
    html += `<textarea id="shortAnswer" rows="4" cols="50" placeholder="type answer..."></textarea>`;
  }
  questionContainer.innerHTML = html;

  // set timer
  const duration = currentQuestion.type === 'multiple-choice' ? getRandomInt(20, 35) : getRandomInt(60, 90);
  startTimer(duration);

  // attach answer handlers
  if (currentQuestion.type === 'multiple-choice') {
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', handleMCAnswer);
    });
  } else {
    document.getElementById('shortAnswer').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitAnswer();
      }
    });
  }
}

// get random int
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// start timer
function startTimer(seconds) {
  let remaining = seconds;
  timerElem.textContent = `time remaining: ${remaining}s`;
  questionTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(questionTimer);
      timerElem.textContent = 'times up!';
      submitAnswer();
    } else {
      timerElem.textContent = `time remaining: ${remaining}s`;
    }
  }, 1000);
}

// handle multiple choice answer
function handleMCAnswer(e) {
  clearTimeout(questionTimer);
  const selectedIdx = parseInt(e.target.dataset.index);
  evaluateAnswer(currentQuestion, selectedIdx);
}

// submit answer for short answer
function submitAnswer() {
  let userAnswer = '';
  if (currentQuestion.type === 'short-answer') {
    userAnswer = document.getElementById('shortAnswer').value.trim();
  }
  evaluateAnswer(currentQuestion, userAnswer);
}

// evaluate answer
function evaluateAnswer(question, userAnswer) {
  // fake correctness for demo
  let isCorrect = false;
  let pointsEarned = 0;
  let rawPoints = 0;

  if (question.type === 'multiple-choice') {
    // pick a random correct answer
    const correctIdx = Math.floor(Math.random() * question.options.length);
    isCorrect = Math.random() > 0.5; // 50/50 chance
    // assign points based on correctness
    pointsEarned = isCorrect ? 10 : -2;
    rawPoints = pointsEarned;
    question.answer = question.options[selectedIdx].text;
  } else {
    // short answer, random correctness
    isCorrect = Math.random() > 0.5;
    pointsEarned = isCorrect ? 18 : -3;
    rawPoints = pointsEarned;
    question.answer = userAnswer;
  }

  // apply powerups
  if (powerUps.doubleJeopardy) {
    pointsEarned *= 2;
  }

  if (powerUps.redemptionArc && !isCorrect) {
    // allow retry
    feedbackDiv.innerHTML = `<p>wrong answer, redemption arc active! retry? (click next to try again)</p>`;
    // save state
    question.retryAvailable = true;
    nextBtn.textContent = 'retry question';
    nextBtn.classList.remove('hidden');
    nextBtn.onclick = () => {
      loadQuestion();
    };
    return;
  } else {
    // show feedback
    feedbackDiv.innerHTML = `<p>${getAnswerExplanation(question, isCorrect, pointsEarned)}</p>`;
    // update stats
    stats.totalQuestions++;
    if (isCorrect) {
      stats.correctAnswers++;
    }
    stats.pointsEarned += pointsEarned;
    stats.rawPoints += rawPoints;
  }

  // show next
  nextBtn.classList.remove('hidden');
  nextBtn.textContent = 'next question';
  nextBtn.onclick = () => {
    loadNextQuestion();
  };
}

// generate answer explanation
function getAnswerExplanation(question, isCorrect, points) {
  if (question.type === 'multiple-choice') {
    const correctOption = question.options[0].text;
    return `
      correct answer: ${correctOption}
      your answer: ${question.answer}
      ${isCorrect ? 'nice job!' : 'oops, wrong answer'}
      points: ${points}
    `;
  } else {
    return `
      your answer: ${question.answer}
      explanation: [AI explanation here.]
    `;
  }
}

// load next question
function loadNextQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex >= questions.length) {
    endSession();
  } else {
    loadQuestion();
  }
}

// end session
function endSession() {
  // calc percentage
  const totalPoints = totalPointsPossible;
  const pointsPercent = (stats.pointsEarned / totalPoints) * 100;
  const passed = pointsPercent >= gradeThresholds.passPercent && (stats.rawPoints / totalPoints) >= gradeThresholds.rawPercent;

  questionSection.classList.add('hidden');
  resultsSection.classList.remove('hidden');

  scoreSummary.innerHTML = `
    <p>total questions: ${questions.length}</p>
    <p>correct answers: ${stats.correctAnswers}</p>
    <p>points: ${stats.pointsEarned} / ${totalPoints}</p>
    <p>percent: ${pointsPercent.toFixed(2)}%</p>
    <p>status: <strong style="color:${passed ? 'green' : 'red'};">${passed ? 'passed' : 'failed'}</strong></p>
  `;

  generateRecommendations();

  showPowerUps();
}

// generate recommendations
function generateRecommendations() {
  const weaknesses = ['math formulas', 'history analysis', 'science concepts'];
  const strengths = ['memory recall', 'problem solving'];
  recommendationsDiv.innerHTML = `
    <h3>tips for next time</h3>
    <p>focus on:</p>
    <ul>
      <li>strengths: ${strengths.join(', ')}</li>
      <li>weaknesses: ${weaknesses.join(', ')}</li>
    </ul>
    <h4>next game ideas</h4>
    <button onclick="startStrengthGame()">improve strengths</button>
    <button onclick="startWeaknessGame()">target weaknesses</button>
  `;
}

// show power-ups
function showPowerUps() {
  // demo: activate all
  powerUps.redemptionArc = true;
  powerUps.doubleJeopardy = true;
  powerUps.fiftyFifty = true;
  powerUps.hint = true;
  alert('power-ups activated! use wisely.');
}

// dummy functions
function startStrengthGame() { alert('improving strengths...'); }
function startWeaknessGame() { alert('targeting weaknesses...'); }

function resetSession() {
  location.reload();
}
