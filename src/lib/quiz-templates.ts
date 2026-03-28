import type { Quiz, Question } from './quiz-types'

export type TemplateAudience = 'Schools' | 'Corporate' | 'Both'

export interface QuizTemplate {
  id: string
  title: string
  description: string
  audience: TemplateAudience
  subject: string
  questionCount: number
  quiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'>
}

function q(
  id: string,
  type: Question['type'],
  text: string,
  options?: string[],
  correctAnswer?: string,
  points: Question['points'] = 1000,
  timerSeconds: Question['timerSeconds'] = 20,
  bloomsLevel?: Question['bloomsLevel'],
  explanation?: string,
): Question {
  return { id, type, text, options, correctAnswer, points, timerSeconds, bloomsLevel, explanation }
}

// ─── 1. Lesson Recap ──────────────────────────────────────────────────────────
const lessonRecapQuiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'> = {
  title: 'Lesson Recap',
  subject: 'General Knowledge',
  language: 'en',
  questions: [
    q('lr1', 'mcq', 'What is the powerhouse of the cell?',
      ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi body'], '1', 1000, 20, 'remember',
      'The mitochondria produces ATP — the cell\'s energy currency.'),
    q('lr2', 'mcq', 'Which planet is closest to the Sun?',
      ['Venus', 'Earth', 'Mercury', 'Mars'], '2', 1000, 20, 'remember'),
    q('lr3', 'mcq', 'What is H₂O commonly known as?',
      ['Hydrogen peroxide', 'Salt water', 'Water', 'Oxygen'], '2', 500, 15, 'remember'),
    q('lr4', 'mcq', 'How many sides does a hexagon have?',
      ['5', '6', '7', '8'], '1', 500, 15, 'remember'),
    q('lr5', 'mcq', 'Which gas do plants absorb during photosynthesis?',
      ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], '2', 1000, 20, 'understand',
      'Plants absorb CO₂ and release O₂ during photosynthesis.'),
    q('lr6', 'mcq', 'What is the chemical symbol for Gold?',
      ['Go', 'Gd', 'Au', 'Ag'], '2', 1000, 20, 'remember'),
    q('lr7', 'mcq', 'In which continent is Egypt located?',
      ['Asia', 'Africa', 'Europe', 'South America'], '1', 500, 15, 'remember'),
    q('lr8', 'mcq', 'What force keeps planets in orbit around the Sun?',
      ['Magnetism', 'Friction', 'Gravity', 'Electricity'], '2', 1000, 20, 'understand'),
    q('lr9', 'mcq', 'How many bones does an adult human body have?',
      ['186', '206', '226', '246'], '1', 1000, 20, 'remember'),
    q('lr10', 'mcq', 'What is the largest organ in the human body?',
      ['Heart', 'Liver', 'Lungs', 'Skin'], '3', 1000, 20, 'remember'),
  ],
}

// ─── 2. Exam Warmup ───────────────────────────────────────────────────────────
const examWarmupQuiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'> = {
  title: 'Exam Warmup',
  subject: 'Mixed',
  language: 'en',
  questions: [
    q('ew1', 'mcq', 'Which of the following is NOT a prime number?',
      ['7', '11', '15', '17'], '2', 2000, 30, 'analyse',
      '15 = 3 × 5, so it\'s not prime.'),
    q('ew2', 'mcq', 'The speed of light in vacuum is approximately:',
      ['3 × 10⁶ m/s', '3 × 10⁸ m/s', '3 × 10¹⁰ m/s', '3 × 10¹² m/s'], '1', 2000, 30, 'remember'),
    q('ew3', 'mcq', 'Which type of bond involves sharing of electrons?',
      ['Ionic bond', 'Covalent bond', 'Hydrogen bond', 'Metallic bond'], '1', 2000, 30, 'understand'),
    q('ew4', 'mcq', 'Ohm\'s Law states that V = ?',
      ['I + R', 'I − R', 'I × R', 'I ÷ R'], '2', 2000, 30, 'remember'),
    q('ew5', 'mcq', 'What is the derivative of sin(x)?',
      ['−cos(x)', 'cos(x)', 'tan(x)', '−sin(x)'], '1', 2000, 30, 'apply',
      'd/dx(sin x) = cos x'),
    q('ew6', 'mcq', 'The process by which plants make food using sunlight is called:',
      ['Respiration', 'Transpiration', 'Photosynthesis', 'Fermentation'], '2', 1000, 20, 'remember'),
    q('ew7', 'mcq', 'Which blood type is called the universal donor?',
      ['A+', 'B+', 'AB+', 'O−'], '3', 2000, 30, 'remember'),
    q('ew8', 'mcq', 'In a triangle, the sum of all angles equals:',
      ['90°', '180°', '270°', '360°'], '1', 500, 15, 'remember'),
    q('ew9', 'truefalse', 'The mitochondria is found only in plant cells.',
      ['True', 'False'], '1', 1000, 20, 'remember',
      'Mitochondria are found in both plant and animal cells.'),
    q('ew10', 'truefalse', 'Water boils at 100°C at standard atmospheric pressure.',
      ['True', 'False'], '0', 500, 15, 'remember'),
  ],
}

// ─── 3. Onboarding Check ──────────────────────────────────────────────────────
const onboardingCheckQuiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'> = {
  title: 'Onboarding Check',
  subject: 'Company Culture & Policies',
  language: 'en',
  questions: [
    q('oc1', 'mcq', 'How many days of paid leave are new employees entitled to in their first year?',
      ['10 days', '15 days', '18 days', '21 days'], '1', 1000, 20, 'remember'),
    q('oc2', 'mcq', 'Which team should you contact for IT access requests?',
      ['HR', 'Finance', 'IT Helpdesk', 'Admin'], '2', 500, 15, 'remember'),
    q('oc3', 'mcq', 'Our company was founded in which year?',
      ['2005', '2010', '2015', '2018'], '1', 500, 15, 'remember'),
    q('oc4', 'mcq', 'What is the notice period for resignation under standard employment terms?',
      ['1 month', '2 months', '3 months', '6 months'], '1', 1000, 20, 'remember'),
    q('oc5', 'mcq', 'Which value best represents our organization\'s approach to customer service?',
      ['Speed first', 'Customer-first always', 'Revenue over relationships', 'Process compliance only'], '1', 1000, 20, 'understand'),
    q('oc6', 'mcq', 'Where do you submit your expense claims?',
      ['Email to Finance', 'The HR portal', 'The expense management system', 'Your direct manager'], '2', 500, 15, 'remember'),
    q('oc7', 'mcq', 'Which of the following is our primary communication tool?',
      ['WhatsApp', 'Telegram', 'Microsoft Teams / Slack', 'Email only'], '2', 500, 15, 'remember'),
    q('oc8', 'mcq', 'What should you do if you observe a policy violation?',
      ['Ignore it', 'Tell colleagues', 'Report it through the whistleblower channel', 'Post on social media'], '2', 1000, 20, 'apply'),
  ],
}

// ─── 4. Compliance Training ───────────────────────────────────────────────────
const complianceTrainingQuiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'> = {
  title: 'Compliance Training',
  subject: 'Workplace Compliance',
  language: 'en',
  questions: [
    q('ct1', 'mcq', 'A vendor offers you a gift worth ₹5,000 before a contract renewal. What do you do?',
      ['Accept it — it\'s a gesture of goodwill', 'Accept but declare it to your manager', 'Decline and report the offer per company policy', 'Accept if no one is watching'], '2', 2000, 30, 'apply',
      'Gifts from vendors before contract decisions must be declined and reported to avoid conflict of interest.'),
    q('ct2', 'mcq', 'Which of the following is NOT considered confidential information?',
      ['Client contracts', 'Employee salaries', 'Publicly available annual report', 'Internal pricing data'], '2', 1000, 20, 'analyse'),
    q('ct3', 'mcq', 'You receive an email asking for your login credentials "for a system upgrade". What do you do?',
      ['Reply with your credentials', 'Forward it to a colleague', 'Delete it and report it as phishing', 'Ignore it'], '2', 2000, 30, 'apply',
      'Legitimate IT teams never ask for passwords via email. This is a phishing attempt.'),
    q('ct4', 'mcq', 'The Data Protection policy requires that customer data must be:',
      ['Shared freely within the team', 'Stored only on personal devices', 'Handled with minimum necessary access', 'Published for transparency'], '2', 1000, 20, 'understand'),
    q('ct5', 'mcq', 'POSH Act (Prevention of Sexual Harassment) requires a complaint to be filed within:',
      ['7 days', '30 days', '90 days', '3 months'], '3', 2000, 30, 'remember'),
    q('ct6', 'mcq', 'Which of the following is a red flag for money laundering?',
      ['Regular monthly salary deposits', 'Multiple small cash deposits just below reporting limit', 'Quarterly bonus transfer', 'Direct debit for rent'], '1', 2000, 30, 'analyse'),
    q('ct7', 'poll', 'How confident are you in identifying a phishing email today?',
      ['Very confident', 'Somewhat confident', 'Not very confident', 'Not sure at all'], undefined, 1000, 30),
    q('ct8', 'poll', 'Have you completed this year\'s mandatory compliance e-learning?',
      ['Yes, completed', 'In progress', 'Not started yet', 'Was not aware of it'], undefined, 1000, 30),
  ],
}

// ─── 5. Town Hall Pulse ───────────────────────────────────────────────────────
const townHallPulseQuiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'> = {
  title: 'Town Hall Pulse',
  subject: 'Employee Feedback',
  language: 'en',
  questions: [
    q('th1', 'poll', 'How would you rate your overall work satisfaction this quarter?',
      ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied'], undefined, 1000, 30),
    q('th2', 'poll', 'Which area needs the most improvement in our organization?',
      ['Communication', 'Recognition & rewards', 'Work-life balance', 'Career growth'], undefined, 1000, 30),
    q('th3', 'poll', 'How effective is our current remote / hybrid work policy?',
      ['Very effective', 'Somewhat effective', 'Needs improvement', 'Not effective at all'], undefined, 1000, 30),
    q('th4', 'poll', 'How would you describe the leadership communication this year?',
      ['Transparent & frequent', 'Adequate', 'Infrequent', 'Unclear'], undefined, 1000, 30),
    q('th5', 'poll', 'Would you recommend this company as a great place to work?',
      ['Definitely yes', 'Probably yes', 'Probably not', 'Definitely not'], undefined, 1000, 30),
    q('th6', 'openended', 'What is one thing you\'d like leadership to prioritize in the next quarter?',
      undefined, undefined, 1000, 60),
    q('th7', 'openended', 'What is one thing you are proud of that our team accomplished this year?',
      undefined, undefined, 1000, 60),
  ],
}

// ─── 6. Icebreaker Trivia ─────────────────────────────────────────────────────
const icebreakerTriviaQuiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'> = {
  title: 'Icebreaker Trivia',
  subject: 'Fun & General Knowledge',
  language: 'en',
  questions: [
    q('ib1', 'mcq', 'Which country has the most natural lakes in the world?',
      ['Russia', 'USA', 'Canada', 'Finland'], '2', 1000, 20),
    q('ib2', 'mcq', 'How many keys does a standard piano have?',
      ['72', '76', '88', '96'], '2', 1000, 20),
    q('ib3', 'mcq', 'Which is the fastest land animal?',
      ['Lion', 'Cheetah', 'Pronghorn antelope', 'Greyhound'], '1', 1000, 20),
    q('ib4', 'mcq', 'What is the world\'s most spoken language by native speakers?',
      ['English', 'Spanish', 'Mandarin Chinese', 'Hindi'], '2', 1000, 20),
    q('ib5', 'mcq', 'In which city is the Eiffel Tower located?',
      ['Rome', 'London', 'Berlin', 'Paris'], '3', 500, 15),
    q('ib6', 'mcq', 'How many continents are there on Earth?',
      ['5', '6', '7', '8'], '2', 500, 15),
    q('ib7', 'mcq', 'What is the smallest planet in our solar system?',
      ['Mars', 'Mercury', 'Pluto', 'Venus'], '1', 1000, 20),
    q('ib8', 'mcq', 'Which sport is played at Wimbledon?',
      ['Cricket', 'Football', 'Tennis', 'Badminton'], '2', 500, 15),
  ],
}

// ─── 7. Team Retrospective ────────────────────────────────────────────────────
const teamRetroQuiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'> = {
  title: 'Team Retrospective',
  subject: 'Team Health',
  language: 'en',
  questions: [
    q('tr1', 'poll', 'How well did our team collaborate this sprint / quarter?',
      ['Excellent', 'Good', 'Could be better', 'Poor'], undefined, 1000, 30),
    q('tr2', 'poll', 'How clear were the goals and priorities this period?',
      ['Very clear', 'Mostly clear', 'Somewhat unclear', 'Very unclear'], undefined, 1000, 30),
    q('tr3', 'poll', 'How sustainable was your workload this period?',
      ['Very sustainable', 'Mostly fine', 'Slightly overloaded', 'Severely overloaded'], undefined, 1000, 30),
    q('tr4', 'poll', 'How effectively did we resolve blockers and dependencies?',
      ['Very quickly', 'Within a reasonable time', 'Slowly, causing delays', 'Blockers were mostly unresolved'], undefined, 1000, 30),
    q('tr5', 'openended', 'What should we START doing in the next sprint / quarter?',
      undefined, undefined, 1000, 60),
    q('tr6', 'openended', 'What should we STOP doing? What\'s slowing us down?',
      undefined, undefined, 1000, 60),
  ],
}

// ─── 8. Subject Deep Dive ─────────────────────────────────────────────────────
const subjectDeepDiveQuiz: Omit<Quiz, 'id' | 'createdAt' | 'updatedAt'> = {
  title: 'Subject Deep Dive',
  subject: 'Biology (Customize)',
  language: 'en',
  questions: [
    q('sd1', 'mcq', 'What is the basic structural unit of life?',
      ['Organ', 'Tissue', 'Cell', 'Atom'], '2', 500, 15, 'remember'),
    q('sd2', 'mcq', 'Which organelle controls the activities of the cell?',
      ['Mitochondria', 'Nucleus', 'Ribosome', 'Vacuole'], '1', 1000, 20, 'remember'),
    q('sd3', 'mcq', 'What is the process of cell division called?',
      ['Meiosis only', 'Mitosis only', 'Mitosis and Meiosis', 'Diffusion'], '2', 1000, 20, 'understand'),
    q('sd4', 'mcq', 'In photosynthesis, which molecule carries energy?',
      ['DNA', 'ATP', 'RNA', 'Glucose'], '1', 1000, 20, 'understand'),
    q('sd5', 'mcq', 'A student notices a plant wilts in direct sunlight. What is the most likely cause?',
      ['Excess CO₂', 'Waterlogging', 'Excessive transpiration', 'Chlorophyll breakdown'], '2', 2000, 30, 'apply'),
    q('sd6', 'mcq', 'Which of the following is an example of passive transport?',
      ['Active pumping', 'Exocytosis', 'Osmosis', 'Endocytosis'], '2', 1000, 20, 'apply'),
    q('sd7', 'mcq', 'An experiment shows Plant A grows faster with red light than green light. What does this suggest?',
      ['Green light is harmful', 'Chlorophyll absorbs more red light', 'Red light increases temperature', 'Wavelength has no effect'], '1', 2000, 30, 'analyse'),
    q('sd8', 'mcq', 'Why does the rate of photosynthesis plateau despite increasing light intensity?',
      ['Plants run out of water', 'CO₂ or enzymes become the limiting factor', 'Chlorophyll breaks down', 'Oxygen blocks light'], '1', 2000, 30, 'analyse'),
    q('sd9', 'mcq', 'A researcher claims all viruses can be killed by antibiotics. This claim is:',
      ['Correct — antibiotics target all pathogens', 'Partially correct for some viruses', 'Incorrect — antibiotics only target bacteria', 'Correct for DNA viruses only'], '2', 2000, 30, 'evaluate'),
    q('sd10', 'mcq', 'Which evidence would BEST support the theory of evolution by natural selection?',
      ['Identical species on all continents', 'Fossil record showing gradual changes over time', 'All animals having the same DNA', 'Species not changing over time'], '1', 2000, 30, 'evaluate'),
    q('sd11', 'mcq', 'Propose the most likely adaptation of a deep-sea fish to its environment:',
      ['Bright colors for mating', 'Bioluminescence to attract prey', 'Large surface area fins', 'High metabolic rate'], '1', 2000, 30, 'create'),
    q('sd12', 'openended', 'Design an experiment to test whether temperature affects enzyme activity. What variables would you control?',
      undefined, undefined, 2000, 60, 'create'),
  ],
}

// ─── Template catalog ─────────────────────────────────────────────────────────
export const QUIZ_TEMPLATES: QuizTemplate[] = [
  {
    id: 'lesson-recap',
    title: 'Lesson Recap',
    description: '10 MCQs to test recall after any lesson. Edit questions to match your topic.',
    audience: 'Schools',
    subject: 'General Knowledge',
    questionCount: 10,
    quiz: lessonRecapQuiz,
  },
  {
    id: 'exam-warmup',
    title: 'Exam Warmup',
    description: '8 harder MCQs + 2 True/False to sharpen exam-day focus.',
    audience: 'Schools',
    subject: 'Mixed Subjects',
    questionCount: 10,
    quiz: examWarmupQuiz,
  },
  {
    id: 'onboarding-check',
    title: 'Onboarding Check',
    description: '8 MCQs covering company culture, policies, and day-one essentials.',
    audience: 'Corporate',
    subject: 'HR / Onboarding',
    questionCount: 8,
    quiz: onboardingCheckQuiz,
  },
  {
    id: 'compliance-training',
    title: 'Compliance Training',
    description: '6 scenario MCQs + 2 polls. Ideal for mandatory compliance sessions.',
    audience: 'Corporate',
    subject: 'Compliance & Ethics',
    questionCount: 8,
    quiz: complianceTrainingQuiz,
  },
  {
    id: 'town-hall-pulse',
    title: 'Town Hall Pulse',
    description: '5 polls + 2 open-ended questions to capture employee sentiment in real time.',
    audience: 'Corporate',
    subject: 'Employee Feedback',
    questionCount: 7,
    quiz: townHallPulseQuiz,
  },
  {
    id: 'icebreaker-trivia',
    title: 'Icebreaker Trivia',
    description: '8 fun general knowledge MCQs. Perfect for warming up any crowd.',
    audience: 'Both',
    subject: 'Fun & General Knowledge',
    questionCount: 8,
    quiz: icebreakerTriviaQuiz,
  },
  {
    id: 'team-retrospective',
    title: 'Team Retrospective',
    description: '4 polls + 2 open-ended prompts for agile team retrospectives.',
    audience: 'Corporate',
    subject: 'Team Health',
    questionCount: 6,
    quiz: teamRetroQuiz,
  },
  {
    id: 'subject-deep-dive',
    title: 'Subject Deep Dive',
    description: '12 questions spanning all 6 Bloom\'s levels — from recall to design.',
    audience: 'Schools',
    subject: 'Biology (Customize)',
    questionCount: 12,
    quiz: subjectDeepDiveQuiz,
  },
]

export function getTemplate(id: string): QuizTemplate | undefined {
  return QUIZ_TEMPLATES.find(t => t.id === id)
}
