import type { RelatedLink } from '@/components/seo/RelatedLinks'

export type TemplateAudience =
  | 'school-teachers'
  | 'coaching-institutes'
  | 'corporate-trainers'
  | 'event-hosts'
  | 'colleges'

export type TemplateGrade =
  | 'class-6-8'
  | 'class-9-10'
  | 'class-11-12'
  | 'jee-neet'
  | 'upsc'
  | 'corporate'
  | 'general'

export interface SampleQuestion {
  question: string
  options: string[]
  answerIndex: number
  bloom?: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'
  explanation?: string
}

export interface QuizTemplate {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  audience: TemplateAudience
  grade: TemplateGrade
  subject: string
  shortDescription: string
  longDescription: string
  totalQuestions: number
  durationMinutes: number
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  bloomMix: string
  cta: string
  sampleQuestions: SampleQuestion[]
  tags: string[]
  related: RelatedLink[]
  publishedAt: string
}

const COMMON_RELATED: RelatedLink[] = [
  { title: 'Templates Gallery', href: '/templates', description: 'Browse all free quiz templates.' },
  { title: 'Live Quiz', href: '/live-quiz', description: 'Live multiplayer quiz engine.' },
  { title: 'AI Quiz Generator', href: '/ai-quiz-generator', description: 'Generate from any PDF or topic.' },
  { title: 'Pricing', href: '/pricing', description: 'Free + Pro plans in INR.' },
]

const TEACHER_RELATED: RelatedLink[] = [
  { title: 'For Teachers', href: '/for/teachers', description: 'Free quizzes for Indian classrooms.' },
  { title: 'NCERT Quiz Generator', href: '/ncert-quiz-generator', description: 'NCERT chapter library.' },
  { title: 'Templates', href: '/templates', description: 'Browse all templates.' },
  { title: 'Pricing', href: '/pricing', description: 'Free covers most classrooms.' },
]

const COACHING_RELATED: RelatedLink[] = [
  { title: 'For Coaching Institutes', href: '/for/coaching-institutes', description: 'Batch-wise mocks + analytics.' },
  { title: 'AI Quiz Generator', href: '/ai-quiz-generator', description: 'Generate from PYQ PDFs.' },
  { title: 'Templates', href: '/templates', description: 'Browse JEE/NEET/UPSC packs.' },
  { title: 'Pricing', href: '/pricing', description: 'Pro for institutes.' },
]

const CORPORATE_RELATED: RelatedLink[] = [
  { title: 'For Corporate Trainers', href: '/for/corporate-trainers', description: 'L&D, onboarding, compliance.' },
  { title: 'Interactive Presentation', href: '/interactive-presentation', description: 'Polls + Q&A in one deck.' },
  { title: 'Templates', href: '/templates', description: 'Browse corporate quiz packs.' },
  { title: 'Pricing', href: '/pricing', description: 'Team plan for L&D.' },
]

const EVENT_RELATED: RelatedLink[] = [
  { title: 'For Event Hosts', href: '/for/event-hosts', description: 'Trivia, polls, conferences.' },
  { title: 'Live Polling', href: '/live-polling', description: 'Real-time audience polls.' },
  { title: 'Templates', href: '/templates', description: 'Browse trivia + event packs.' },
  { title: 'Pricing', href: '/pricing', description: 'Event-host plans.' },
]

const COLLEGE_RELATED: RelatedLink[] = [
  { title: 'For Colleges', href: '/for/colleges', description: 'Interactive lectures and live polls for colleges.' },
  { title: 'For Teachers', href: '/for/teachers', description: 'How individual teachers use Quizotic.' },
  { title: 'College Templates', href: '/templates#audience-colleges', description: 'Quiz and presentation templates for college lectures.' },
  { title: 'Interactive Presentation', href: '/interactive-presentation', description: 'Polls, word clouds, Q&A in one deck.' },
  { title: 'vs Mentimeter', href: '/vs/mentimeter', description: 'Quizotic vs Mentimeter for college use.' },
  { title: 'Live Polling', href: '/live-polling', description: 'Real-time audience polls for lectures.' },
]

// Compact builder so 50 templates don't bloat the file too much
function makeTemplate(t: Partial<QuizTemplate> & {
  slug: string
  title: string
  audience: TemplateAudience
  grade: TemplateGrade
  subject: string
  shortDescription: string
  totalQuestions: number
  sampleQuestions: SampleQuestion[]
}): QuizTemplate {
  const defaults: QuizTemplate = {
    slug: t.slug,
    title: t.title,
    metaTitle: t.metaTitle ?? `${t.title} — Free Quiz Template (Quizotic)`,
    metaDescription: t.metaDescription ?? `${t.shortDescription} Free download or one-click import to Quizotic for live classroom or batch use.`,
    audience: t.audience,
    grade: t.grade,
    subject: t.subject,
    shortDescription: t.shortDescription,
    longDescription: t.longDescription ?? t.shortDescription,
    totalQuestions: t.totalQuestions,
    durationMinutes: t.durationMinutes ?? Math.ceil(t.totalQuestions * 0.75),
    difficulty: t.difficulty ?? 'mixed',
    bloomMix: t.bloomMix ?? '50% Remember/Understand, 35% Apply, 15% Analyze',
    cta: t.cta ?? 'Use this template',
    sampleQuestions: t.sampleQuestions,
    tags: t.tags ?? [],
    related: t.related ?? COMMON_RELATED,
    publishedAt: t.publishedAt ?? '2026-04-29',
  }
  return defaults
}

export const TEMPLATES: Record<string, QuizTemplate> = {
  // ============ CBSE Class 10 (5) ============
  'cbse-class-10-master-pack': makeTemplate({
    slug: 'cbse-class-10-master-pack',
    title: 'CBSE Class 10 Master Pack — Science + Math + SST',
    audience: 'school-teachers',
    grade: 'class-9-10',
    subject: 'Mixed (Science, Math, SST)',
    shortDescription: '50 board-aligned MCQs across Science, Math, and Social Science — full Class 10 revision pack.',
    longDescription:
      'A complete CBSE Class 10 revision pack — 20 Science, 15 Math, 15 SST. NCERT-aligned, Bloom-tagged, PYQ-style. Use as a final mock or split chapter-wise across the year.',
    totalQuestions: 50,
    durationMinutes: 60,
    difficulty: 'mixed',
    sampleQuestions: [
      {
        question: 'A concave mirror produces a real image five times the size of the object placed at 10 cm from the mirror. Find the focal length.',
        options: ['8.33 cm', '12 cm', '15 cm', '20 cm'],
        answerIndex: 0,
        bloom: 'apply',
        explanation: 'Magnification m = -v/u = -5 → v = 50 cm. Mirror formula: 1/f = 1/v + 1/u → f = -8.33 cm.',
      },
      {
        question: 'The HCF of 96 and 404 is:',
        options: ['4', '8', '6', '12'],
        answerIndex: 0,
        bloom: 'apply',
        explanation: 'Use Euclid\'s algorithm: 404 = 96×4 + 20; 96 = 20×4 + 16; 20 = 16×1 + 4; 16 = 4×4 + 0. HCF = 4.',
      },
      {
        question: 'Which Indian leader gave the slogan "Do or Die" during the Quit India Movement?',
        options: ['Jawaharlal Nehru', 'Mahatma Gandhi', 'Subhas Chandra Bose', 'Sardar Patel'],
        answerIndex: 1,
        bloom: 'remember',
      },
    ],
    tags: ['cbse', 'class 10', 'board prep', 'science', 'math', 'sst'],
    related: TEACHER_RELATED,
  }),
  'cbse-class-10-science-light': makeTemplate({
    slug: 'cbse-class-10-science-light',
    title: 'CBSE Class 10 Science — Light: Reflection & Refraction',
    audience: 'school-teachers',
    grade: 'class-9-10',
    subject: 'Science (Physics)',
    shortDescription: '20 MCQs on Light: Reflection & Refraction (NCERT Class 10 Chapter 10).',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'The image formed by a convex mirror is always:',
        options: ['Real and inverted', 'Virtual and erect', 'Real and erect', 'Virtual and inverted'],
        answerIndex: 1,
        bloom: 'understand',
      },
      {
        question: 'Power of a lens of focal length 20 cm is:',
        options: ['+5 D', '-5 D', '+0.5 D', '-0.5 D'],
        answerIndex: 0,
        bloom: 'apply',
        explanation: 'P = 1/f (in metres) = 1/0.20 = +5 D (convex assumed).',
      },
    ],
    tags: ['cbse', 'class 10', 'physics', 'light', 'optics'],
    related: TEACHER_RELATED,
  }),
  'cbse-class-10-math-quadratic': makeTemplate({
    slug: 'cbse-class-10-math-quadratic',
    title: 'CBSE Class 10 Math — Quadratic Equations',
    audience: 'school-teachers',
    grade: 'class-9-10',
    subject: 'Math',
    shortDescription: '20 MCQs on Quadratic Equations — discriminant, roots, real-life applications.',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'The roots of the equation x² − 5x + 6 = 0 are:',
        options: ['1, 6', '2, 3', '−2, −3', '−1, 6'],
        answerIndex: 1,
        bloom: 'apply',
      },
      {
        question: 'Discriminant of 2x² + 3x − 5 = 0 is:',
        options: ['49', '9 + 40', '9 − 40', 'None'],
        answerIndex: 0,
        bloom: 'apply',
        explanation: 'D = b² − 4ac = 9 + 40 = 49.',
      },
    ],
    tags: ['cbse', 'class 10', 'math', 'quadratic', 'algebra'],
    related: TEACHER_RELATED,
  }),
  'cbse-class-10-sst-nationalism': makeTemplate({
    slug: 'cbse-class-10-sst-nationalism',
    title: 'CBSE Class 10 SST — Nationalism in India',
    audience: 'school-teachers',
    grade: 'class-9-10',
    subject: 'Social Science (History)',
    shortDescription: '20 MCQs on Nationalism in India (NCERT Class 10 History Chapter 2).',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'The Rowlatt Act was passed in:',
        options: ['1917', '1918', '1919', '1921'],
        answerIndex: 2,
        bloom: 'remember',
      },
      {
        question: 'The Non-Cooperation Movement was withdrawn after which event?',
        options: ['Jallianwala Bagh', 'Chauri Chaura', 'Salt March', 'Lahore Session'],
        answerIndex: 1,
        bloom: 'remember',
      },
    ],
    tags: ['cbse', 'class 10', 'sst', 'history', 'nationalism'],
    related: TEACHER_RELATED,
  }),
  'cbse-class-10-pre-board-mock': makeTemplate({
    slug: 'cbse-class-10-pre-board-mock',
    title: 'CBSE Class 10 Pre-Board Mock Test',
    audience: 'school-teachers',
    grade: 'class-9-10',
    subject: 'Mixed',
    shortDescription: '40-question pre-board mock — mixed Science/Math/SST/English. 90 minutes.',
    totalQuestions: 40,
    durationMinutes: 90,
    sampleQuestions: [
      {
        question: 'Which Indian state has the longest coastline?',
        options: ['Tamil Nadu', 'Andhra Pradesh', 'Gujarat', 'Maharashtra'],
        answerIndex: 2,
        bloom: 'remember',
      },
    ],
    tags: ['cbse', 'class 10', 'mock test', 'board prep'],
    related: TEACHER_RELATED,
  }),

  // ============ CBSE Class 9 (3) ============
  'cbse-class-9-science-motion': makeTemplate({
    slug: 'cbse-class-9-science-motion',
    title: 'CBSE Class 9 Science — Motion',
    audience: 'school-teachers',
    grade: 'class-9-10',
    subject: 'Science (Physics)',
    shortDescription: '20 MCQs on Motion — distance, displacement, velocity, equations of motion.',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'A car covers 60 km in first hour and 40 km in second hour. Average speed is:',
        options: ['50 km/h', '48 km/h', '100 km/h', '120 km/h'],
        answerIndex: 0,
        bloom: 'apply',
        explanation: 'Total distance / Total time = 100/2 = 50 km/h.',
      },
    ],
    tags: ['cbse', 'class 9', 'physics', 'motion'],
    related: TEACHER_RELATED,
  }),
  'cbse-class-9-math-polynomials': makeTemplate({
    slug: 'cbse-class-9-math-polynomials',
    title: 'CBSE Class 9 Math — Polynomials',
    audience: 'school-teachers',
    grade: 'class-9-10',
    subject: 'Math',
    shortDescription: '20 MCQs on Polynomials — degree, factorisation, identities.',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'Degree of polynomial 5x³ + 2x² + 7 is:',
        options: ['1', '2', '3', '7'],
        answerIndex: 2,
        bloom: 'remember',
      },
    ],
    tags: ['cbse', 'class 9', 'math', 'polynomials'],
    related: TEACHER_RELATED,
  }),
  'cbse-class-9-sst-democracy': makeTemplate({
    slug: 'cbse-class-9-sst-democracy',
    title: 'CBSE Class 9 SST — What is Democracy?',
    audience: 'school-teachers',
    grade: 'class-9-10',
    subject: 'Social Science (Civics)',
    shortDescription: '15 MCQs on Democracy — features, types, evolution.',
    totalQuestions: 15,
    sampleQuestions: [
      {
        question: 'Which of the following is NOT a feature of democracy?',
        options: ['Free elections', 'Rule of law', 'Hereditary rule', 'Citizens\' rights'],
        answerIndex: 2,
        bloom: 'understand',
      },
    ],
    tags: ['cbse', 'class 9', 'sst', 'civics', 'democracy'],
    related: TEACHER_RELATED,
  }),

  // ============ CBSE Class 8 (3) ============
  'cbse-class-8-science-microorganisms': makeTemplate({
    slug: 'cbse-class-8-science-microorganisms',
    title: 'CBSE Class 8 Science — Microorganisms',
    audience: 'school-teachers',
    grade: 'class-6-8',
    subject: 'Science (Biology)',
    shortDescription: '15 MCQs on Microorganisms — bacteria, viruses, fungi, friend or foe.',
    totalQuestions: 15,
    sampleQuestions: [
      {
        question: 'Which microorganism causes malaria?',
        options: ['Bacteria', 'Virus', 'Protozoa', 'Fungi'],
        answerIndex: 2,
        bloom: 'remember',
      },
    ],
    tags: ['cbse', 'class 8', 'biology', 'microorganisms'],
    related: TEACHER_RELATED,
  }),
  'cbse-class-8-math-rational-numbers': makeTemplate({
    slug: 'cbse-class-8-math-rational-numbers',
    title: 'CBSE Class 8 Math — Rational Numbers',
    audience: 'school-teachers',
    grade: 'class-6-8',
    subject: 'Math',
    shortDescription: '15 MCQs on Rational Numbers — properties, operations, real-life examples.',
    totalQuestions: 15,
    sampleQuestions: [
      {
        question: 'Multiplicative inverse of -3/7 is:',
        options: ['7/3', '-7/3', '3/7', '-3/7'],
        answerIndex: 1,
        bloom: 'apply',
      },
    ],
    tags: ['cbse', 'class 8', 'math', 'rational numbers'],
    related: TEACHER_RELATED,
  }),
  'cbse-class-7-science-nutrition': makeTemplate({
    slug: 'cbse-class-7-science-nutrition',
    title: 'CBSE Class 7 Science — Nutrition in Plants & Animals',
    audience: 'school-teachers',
    grade: 'class-6-8',
    subject: 'Science (Biology)',
    shortDescription: '15 MCQs on Nutrition — autotrophs, heterotrophs, photosynthesis.',
    totalQuestions: 15,
    sampleQuestions: [
      {
        question: 'Photosynthesis primarily occurs in:',
        options: ['Roots', 'Leaves', 'Stem', 'Flowers'],
        answerIndex: 1,
        bloom: 'remember',
      },
    ],
    tags: ['cbse', 'class 7', 'biology', 'nutrition'],
    related: TEACHER_RELATED,
  }),

  // ============ JEE / NEET (8) ============
  'jee-physics-mechanics': makeTemplate({
    slug: 'jee-physics-mechanics',
    title: 'JEE Physics — Mechanics Drill',
    audience: 'coaching-institutes',
    grade: 'jee-neet',
    subject: 'Physics',
    shortDescription: '20 PYQ-style MCQs on Mechanics — Kinematics, Newton\'s Laws, Rotation, Gravitation.',
    totalQuestions: 20,
    durationMinutes: 30,
    difficulty: 'hard',
    bloomMix: '20% Understand, 60% Apply, 20% Analyze',
    sampleQuestions: [
      {
        question: 'A particle moves in a straight line with velocity v = 4t² − 6t. At t = 0, v = 0. Acceleration at t = 2 s is:',
        options: ['10 m/s²', '12 m/s²', '8 m/s²', '14 m/s²'],
        answerIndex: 0,
        bloom: 'apply',
        explanation: 'a = dv/dt = 8t − 6. At t = 2: a = 16 − 6 = 10 m/s².',
      },
    ],
    tags: ['jee', 'physics', 'mechanics', 'pyq'],
    related: COACHING_RELATED,
  }),
  'jee-physics-electromagnetism': makeTemplate({
    slug: 'jee-physics-electromagnetism',
    title: 'JEE Physics — Electromagnetism Drill',
    audience: 'coaching-institutes',
    grade: 'jee-neet',
    subject: 'Physics',
    shortDescription: '20 MCQs on Electrostatics, Magnetism, EMI, AC.',
    totalQuestions: 20,
    durationMinutes: 30,
    difficulty: 'hard',
    sampleQuestions: [
      {
        question: 'A 2 μF capacitor is charged to 100 V. Energy stored is:',
        options: ['10⁻² J', '2×10⁻² J', '10⁻⁴ J', '10⁻³ J'],
        answerIndex: 0,
        bloom: 'apply',
        explanation: 'U = ½CV² = ½ × 2×10⁻⁶ × 10⁴ = 10⁻² J.',
      },
    ],
    tags: ['jee', 'physics', 'electromagnetism'],
    related: COACHING_RELATED,
  }),
  'jee-chemistry-organic': makeTemplate({
    slug: 'jee-chemistry-organic',
    title: 'JEE Chemistry — Organic Drill',
    audience: 'coaching-institutes',
    grade: 'jee-neet',
    subject: 'Chemistry',
    shortDescription: '25 MCQs on Organic Chemistry — Hydrocarbons, Functional groups, Reactions.',
    totalQuestions: 25,
    durationMinutes: 35,
    difficulty: 'hard',
    sampleQuestions: [
      {
        question: 'Markovnikov\'s rule is followed in addition of HBr to:',
        options: ['Symmetric alkene', 'Asymmetric alkene', 'Alkyne only', 'Aromatic ring'],
        answerIndex: 1,
        bloom: 'understand',
      },
    ],
    tags: ['jee', 'chemistry', 'organic'],
    related: COACHING_RELATED,
  }),
  'jee-math-calculus': makeTemplate({
    slug: 'jee-math-calculus',
    title: 'JEE Math — Calculus Drill',
    audience: 'coaching-institutes',
    grade: 'jee-neet',
    subject: 'Math',
    shortDescription: '25 MCQs on Limits, Differentiation, Integration, Applications.',
    totalQuestions: 25,
    durationMinutes: 40,
    difficulty: 'hard',
    sampleQuestions: [
      {
        question: 'Limit of (sin 3x)/x as x → 0 is:',
        options: ['1', '3', '0', 'Undefined'],
        answerIndex: 1,
        bloom: 'apply',
      },
    ],
    tags: ['jee', 'math', 'calculus'],
    related: COACHING_RELATED,
  }),
  'neet-biology-genetics': makeTemplate({
    slug: 'neet-biology-genetics',
    title: 'NEET Biology — Genetics Drill',
    audience: 'coaching-institutes',
    grade: 'jee-neet',
    subject: 'Biology',
    shortDescription: '25 MCQs on Mendelian genetics, molecular genetics, inheritance patterns.',
    totalQuestions: 25,
    durationMinutes: 30,
    sampleQuestions: [
      {
        question: 'Down\'s syndrome is caused by:',
        options: ['Trisomy 21', 'Trisomy 18', 'Trisomy 13', 'Monosomy X'],
        answerIndex: 0,
        bloom: 'remember',
      },
    ],
    tags: ['neet', 'biology', 'genetics'],
    related: COACHING_RELATED,
  }),
  'neet-biology-reproduction': makeTemplate({
    slug: 'neet-biology-reproduction',
    title: 'NEET Biology — Reproduction Drill',
    audience: 'coaching-institutes',
    grade: 'jee-neet',
    subject: 'Biology',
    shortDescription: '25 MCQs on Reproduction in plants and animals, Reproductive Health.',
    totalQuestions: 25,
    durationMinutes: 30,
    sampleQuestions: [
      {
        question: 'In angiosperms, double fertilization results in formation of:',
        options: ['Embryo only', 'Endosperm only', 'Embryo and endosperm', 'Seed coat only'],
        answerIndex: 2,
        bloom: 'understand',
      },
    ],
    tags: ['neet', 'biology', 'reproduction'],
    related: COACHING_RELATED,
  }),
  'neet-chemistry-mole-concept': makeTemplate({
    slug: 'neet-chemistry-mole-concept',
    title: 'NEET Chemistry — Mole Concept',
    audience: 'coaching-institutes',
    grade: 'jee-neet',
    subject: 'Chemistry',
    shortDescription: '20 MCQs on Mole, Molarity, Stoichiometry, Empirical & Molecular formulae.',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'Number of moles in 22 g of CO₂ (molar mass 44 g/mol) is:',
        options: ['0.25', '0.5', '1', '2'],
        answerIndex: 1,
        bloom: 'apply',
      },
    ],
    tags: ['neet', 'chemistry', 'mole concept'],
    related: COACHING_RELATED,
  }),
  'jee-foundation-class-9-pcm': makeTemplate({
    slug: 'jee-foundation-class-9-pcm',
    title: 'JEE Foundation Class 9 — PCM Drill',
    audience: 'coaching-institutes',
    grade: 'class-9-10',
    subject: 'Mixed (PCM)',
    shortDescription: '30 MCQs covering Class 9 NCERT Physics, Chemistry, Math — JEE Foundation pattern.',
    totalQuestions: 30,
    durationMinutes: 45,
    sampleQuestions: [
      {
        question: 'Speed of light in vacuum is:',
        options: ['3×10⁸ m/s', '3×10⁵ km/s', '3×10⁵ m/s', 'Both A and B'],
        answerIndex: 3,
        bloom: 'remember',
      },
    ],
    tags: ['jee foundation', 'class 9', 'pcm'],
    related: COACHING_RELATED,
  }),

  // ============ UPSC (4) ============
  'upsc-prelims-polity': makeTemplate({
    slug: 'upsc-prelims-polity',
    title: 'UPSC Prelims — Indian Polity Drill',
    audience: 'coaching-institutes',
    grade: 'upsc',
    subject: 'Polity',
    shortDescription: '25 MCQs on Indian Polity — Constitution, Fundamental Rights, Parliament, Judiciary.',
    totalQuestions: 25,
    durationMinutes: 25,
    sampleQuestions: [
      {
        question: 'The Right to Constitutional Remedies is enshrined in which article?',
        options: ['Article 32', 'Article 19', 'Article 21', 'Article 14'],
        answerIndex: 0,
        bloom: 'remember',
      },
    ],
    tags: ['upsc', 'prelims', 'polity'],
    related: COACHING_RELATED,
  }),
  'upsc-prelims-modern-history': makeTemplate({
    slug: 'upsc-prelims-modern-history',
    title: 'UPSC Prelims — Modern History Drill',
    audience: 'coaching-institutes',
    grade: 'upsc',
    subject: 'History',
    shortDescription: '25 MCQs on Modern Indian History — colonial era, freedom struggle, post-independence.',
    totalQuestions: 25,
    sampleQuestions: [
      {
        question: 'The Subsidiary Alliance was introduced by:',
        options: ['Lord Wellesley', 'Lord Dalhousie', 'Lord Curzon', 'Lord Cornwallis'],
        answerIndex: 0,
        bloom: 'remember',
      },
    ],
    tags: ['upsc', 'prelims', 'modern history'],
    related: COACHING_RELATED,
  }),
  'upsc-current-affairs-weekly': makeTemplate({
    slug: 'upsc-current-affairs-weekly',
    title: 'UPSC Current Affairs — Weekly Drill',
    audience: 'coaching-institutes',
    grade: 'upsc',
    subject: 'Current Affairs',
    shortDescription: '20 MCQs on the past week\'s key current affairs — schemes, IR, economy.',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'PM Vishwakarma scheme is targeted at:',
        options: ['Farmers', 'Traditional artisans and craftspeople', 'MSMEs', 'Startups'],
        answerIndex: 1,
        bloom: 'remember',
      },
    ],
    tags: ['upsc', 'current affairs'],
    related: COACHING_RELATED,
  }),
  'upsc-prelims-environment': makeTemplate({
    slug: 'upsc-prelims-environment',
    title: 'UPSC Prelims — Environment & Ecology',
    audience: 'coaching-institutes',
    grade: 'upsc',
    subject: 'Environment',
    shortDescription: '25 MCQs on Environment, Biodiversity, Climate Change, Conservation.',
    totalQuestions: 25,
    sampleQuestions: [
      {
        question: 'The Ramsar Convention is related to:',
        options: ['Wetlands', 'Forests', 'Oceans', 'Climate change'],
        answerIndex: 0,
        bloom: 'remember',
      },
    ],
    tags: ['upsc', 'environment', 'ecology'],
    related: COACHING_RELATED,
  }),

  // ============ Corporate Training (8) ============
  'corporate-onboarding-india': makeTemplate({
    slug: 'corporate-onboarding-india',
    title: 'Corporate Onboarding Quiz (India Edition)',
    audience: 'corporate-trainers',
    grade: 'corporate',
    subject: 'Onboarding',
    shortDescription: '30 questions covering company history, products, policies, POSH, IT security.',
    totalQuestions: 30,
    durationMinutes: 25,
    sampleQuestions: [
      {
        question: 'Under POSH Act, an Internal Complaints Committee (ICC) is required if the workplace has:',
        options: ['10 or more employees', '20 or more employees', '50 or more employees', '100 or more employees'],
        answerIndex: 0,
        bloom: 'remember',
      },
    ],
    tags: ['corporate', 'onboarding', 'posh'],
    related: CORPORATE_RELATED,
  }),
  'posh-compliance-quiz': makeTemplate({
    slug: 'posh-compliance-quiz',
    title: 'POSH (Sexual Harassment) Compliance Quiz',
    audience: 'corporate-trainers',
    grade: 'corporate',
    subject: 'Compliance',
    shortDescription: '20 questions on POSH Act, ICC role, complaint process, retaliation. Audit-ready report.',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'The POSH Act mandates a written complaint within:',
        options: ['3 months of incident, extendable by 3 more', '6 months only', '12 months', 'No time limit'],
        answerIndex: 0,
        bloom: 'remember',
      },
    ],
    tags: ['compliance', 'posh', 'audit-ready'],
    related: CORPORATE_RELATED,
  }),
  'data-privacy-dpdp-quiz': makeTemplate({
    slug: 'data-privacy-dpdp-quiz',
    title: 'Data Privacy (DPDP Act 2023) Quiz',
    audience: 'corporate-trainers',
    grade: 'corporate',
    subject: 'Compliance',
    shortDescription: '20 questions on DPDP Act, consent, data fiduciary, breach handling.',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'Under DPDP Act, the Data Principal is:',
        options: ['The data fiduciary', 'The individual whose data is processed', 'The Data Protection Board', 'The data processor'],
        answerIndex: 1,
        bloom: 'understand',
      },
    ],
    tags: ['compliance', 'data privacy', 'dpdp'],
    related: CORPORATE_RELATED,
  }),
  'sales-product-knowledge': makeTemplate({
    slug: 'sales-product-knowledge',
    title: 'Sales Product Knowledge Quiz Template',
    audience: 'corporate-trainers',
    grade: 'corporate',
    subject: 'Sales',
    shortDescription: '20 question template for sales kickoffs — customize with your product details.',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: '[Customize] Your flagship product\'s top differentiator is:',
        options: ['Price', 'Speed', 'Quality', 'Support'],
        answerIndex: 0,
        bloom: 'remember',
      },
    ],
    tags: ['sales', 'product knowledge', 'kickoff'],
    related: CORPORATE_RELATED,
  }),
  'objection-handling-quiz': makeTemplate({
    slug: 'objection-handling-quiz',
    title: 'Sales Objection Handling Quiz',
    audience: 'corporate-trainers',
    grade: 'corporate',
    subject: 'Sales',
    shortDescription: '15 scenario-based questions on handling sales objections.',
    totalQuestions: 15,
    sampleQuestions: [
      {
        question: 'Prospect: "Your price is too high." Best response:',
        options: ['Offer immediate discount', 'Ask: what\'s the comparison point?', 'Drop the deal', 'Quote a higher anchor first'],
        answerIndex: 1,
        bloom: 'apply',
      },
    ],
    tags: ['sales', 'objection handling'],
    related: CORPORATE_RELATED,
  }),
  'leadership-feedback-poll': makeTemplate({
    slug: 'leadership-feedback-poll',
    title: 'Leadership Workshop — Live Feedback Poll',
    audience: 'corporate-trainers',
    grade: 'corporate',
    subject: 'Leadership',
    shortDescription: '12 opinion polls + word clouds for leadership workshops.',
    totalQuestions: 12,
    sampleQuestions: [
      {
        question: 'Which leadership behaviour matters most in a fast-growing team?',
        options: ['Clarity of direction', 'Empathy', 'Decisiveness', 'Coaching'],
        answerIndex: 0,
        bloom: 'evaluate',
      },
    ],
    tags: ['leadership', 'workshop', 'poll'],
    related: CORPORATE_RELATED,
  }),
  'team-icebreaker-india': makeTemplate({
    slug: 'team-icebreaker-india',
    title: 'Team Meeting Icebreaker (India Edition)',
    audience: 'corporate-trainers',
    grade: 'corporate',
    subject: 'Team Building',
    shortDescription: '15 light icebreaker questions — Bollywood, sports, city life, opinion polls.',
    totalQuestions: 15,
    bloomMix: 'N/A — opinion polls and word clouds',
    sampleQuestions: [
      {
        question: 'Best workday lunch in your city — pick one:',
        options: ['Idli-vada', 'Veg thali', 'Roti-sabzi', 'Biryani'],
        answerIndex: 0,
        bloom: 'remember',
      },
    ],
    tags: ['team building', 'icebreaker', 'corporate'],
    related: CORPORATE_RELATED,
  }),
  'security-awareness-phishing': makeTemplate({
    slug: 'security-awareness-phishing',
    title: 'Security Awareness — Phishing & Password Hygiene',
    audience: 'corporate-trainers',
    grade: 'corporate',
    subject: 'IT Security',
    shortDescription: '15 questions on phishing detection, password best practices, BYOD security.',
    totalQuestions: 15,
    sampleQuestions: [
      {
        question: 'Strongest password:',
        options: ['Password123', 'Tr0ub4dor&3', 'correct horse battery staple', 'Use a password manager + unique random per site'],
        answerIndex: 3,
        bloom: 'evaluate',
      },
    ],
    tags: ['security', 'phishing', 'password'],
    related: CORPORATE_RELATED,
  }),

  // ============ Event / Trivia (5) ============
  'office-trivia-night-india': makeTemplate({
    slug: 'office-trivia-night-india',
    title: 'Office Trivia Night (India Edition)',
    audience: 'event-hosts',
    grade: 'general',
    subject: 'Trivia',
    shortDescription: '40-question trivia night — Bollywood, sports, history, geography, pop culture.',
    totalQuestions: 40,
    durationMinutes: 60,
    sampleQuestions: [
      {
        question: 'Which Indian state has the most UNESCO World Heritage Sites?',
        options: ['Maharashtra', 'Madhya Pradesh', 'Karnataka', 'Rajasthan'],
        answerIndex: 0,
        bloom: 'remember',
      },
    ],
    tags: ['trivia', 'office', 'team night'],
    related: EVENT_RELATED,
  }),
  'bollywood-trivia-pack': makeTemplate({
    slug: 'bollywood-trivia-pack',
    title: 'Bollywood Trivia Pack',
    audience: 'event-hosts',
    grade: 'general',
    subject: 'Pop culture',
    shortDescription: '25 Bollywood trivia questions — golden era to current.',
    totalQuestions: 25,
    sampleQuestions: [
      {
        question: 'Sholay was released in:',
        options: ['1973', '1975', '1977', '1980'],
        answerIndex: 1,
        bloom: 'remember',
      },
    ],
    tags: ['bollywood', 'trivia', 'entertainment'],
    related: EVENT_RELATED,
  }),
  'cricket-trivia-pack': makeTemplate({
    slug: 'cricket-trivia-pack',
    title: 'Cricket Trivia Pack',
    audience: 'event-hosts',
    grade: 'general',
    subject: 'Sports',
    shortDescription: '25 cricket trivia questions — Indian team focus, ICC events, records.',
    totalQuestions: 25,
    sampleQuestions: [
      {
        question: 'India\'s first ICC Cricket World Cup win:',
        options: ['1975', '1983', '1996', '2011'],
        answerIndex: 1,
        bloom: 'remember',
      },
    ],
    tags: ['cricket', 'sports', 'trivia'],
    related: EVENT_RELATED,
  }),
  'general-knowledge-india': makeTemplate({
    slug: 'general-knowledge-india',
    title: 'General Knowledge — India',
    audience: 'event-hosts',
    grade: 'general',
    subject: 'GK',
    shortDescription: '30 GK questions on India — geography, polity, economy, history.',
    totalQuestions: 30,
    sampleQuestions: [
      {
        question: 'Which is the longest river entirely within India?',
        options: ['Ganga', 'Godavari', 'Narmada', 'Krishna'],
        answerIndex: 1,
        bloom: 'remember',
      },
    ],
    tags: ['gk', 'india', 'general knowledge'],
    related: EVENT_RELATED,
  }),
  'conference-opening-poll': makeTemplate({
    slug: 'conference-opening-poll',
    title: 'Conference Opening Poll Pack',
    audience: 'event-hosts',
    grade: 'general',
    subject: 'Polling',
    shortDescription: '10 opening polls + word clouds for conferences. Set the energy in 90 seconds.',
    totalQuestions: 10,
    sampleQuestions: [
      {
        question: 'Where are you joining from? (city)',
        options: ['Open text — word cloud'],
        answerIndex: 0,
      },
    ],
    tags: ['conference', 'polling', 'word cloud'],
    related: EVENT_RELATED,
  }),

  // ============ College / Higher Ed (5) ============
  'college-mid-lecture-poll': makeTemplate({
    slug: 'college-mid-lecture-poll',
    title: 'College — Mid-Lecture Pulse Poll',
    audience: 'colleges',
    grade: 'general',
    subject: 'Higher Ed',
    shortDescription: 'Quick pulse polls to break a 60-minute lecture. 8 questions, customisable.',
    totalQuestions: 8,
    sampleQuestions: [
      {
        question: 'Which concept feels cloudy so far?',
        options: ['Concept A', 'Concept B', 'Concept C', 'Nothing — clear so far'],
        answerIndex: 3,
        bloom: 'evaluate',
      },
    ],
    tags: ['college', 'lecture', 'pulse poll'],
    related: COLLEGE_RELATED,
  }),
  'college-end-class-recap': makeTemplate({
    slug: 'college-end-class-recap',
    title: 'College — End-of-Class Recap Quiz',
    audience: 'colleges',
    grade: 'general',
    subject: 'Higher Ed',
    shortDescription: '5-question recap quiz template for end of college lectures.',
    totalQuestions: 5,
    durationMinutes: 5,
    sampleQuestions: [
      {
        question: '[Customize] Today\'s first key concept was:',
        options: ['A', 'B', 'C', 'D'],
        answerIndex: 0,
        bloom: 'understand',
      },
    ],
    tags: ['college', 'recap', 'formative assessment'],
    related: COLLEGE_RELATED,
  }),
  'college-flipped-classroom': makeTemplate({
    slug: 'college-flipped-classroom',
    title: 'College — Flipped Classroom Pre-Reading Quiz',
    audience: 'colleges',
    grade: 'general',
    subject: 'Higher Ed',
    shortDescription: '10-question template for testing pre-class reading. Customise per chapter.',
    totalQuestions: 10,
    sampleQuestions: [
      {
        question: '[Customize per reading]',
        options: ['A', 'B', 'C', 'D'],
        answerIndex: 0,
        bloom: 'understand',
      },
    ],
    tags: ['college', 'flipped classroom'],
    related: COLLEGE_RELATED,
  }),
  'engineering-data-structures': makeTemplate({
    slug: 'engineering-data-structures',
    title: 'Engineering — Data Structures MCQ Drill',
    audience: 'colleges',
    grade: 'general',
    subject: 'Computer Science',
    shortDescription: '25 MCQs on Arrays, Linked Lists, Stacks, Queues, Trees, Hashing.',
    totalQuestions: 25,
    sampleQuestions: [
      {
        question: 'Best-case time complexity of binary search is:',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        answerIndex: 0,
        bloom: 'remember',
      },
    ],
    tags: ['engineering', 'data structures', 'cs'],
    related: COLLEGE_RELATED,
  }),
  'mba-marketing-quiz': makeTemplate({
    slug: 'mba-marketing-quiz',
    title: 'MBA — Marketing Fundamentals Quiz',
    audience: 'colleges',
    grade: 'general',
    subject: 'Management',
    shortDescription: '25 MCQs on the 4Ps, segmentation, branding, consumer behaviour.',
    totalQuestions: 25,
    sampleQuestions: [
      {
        question: 'In Maslow\'s hierarchy, the highest level is:',
        options: ['Esteem', 'Self-actualization', 'Belonging', 'Safety'],
        answerIndex: 1,
        bloom: 'remember',
      },
    ],
    tags: ['mba', 'marketing', 'management'],
    related: COLLEGE_RELATED,
  }),

  // ============ Hindi-medium templates (5) ============
  'hindi-medium-class-10-vigyan': makeTemplate({
    slug: 'hindi-medium-class-10-vigyan',
    title: 'CBSE हिंदी माध्यम — कक्षा 10 विज्ञान',
    audience: 'school-teachers',
    grade: 'class-9-10',
    subject: 'विज्ञान (Hindi-medium Science)',
    shortDescription: 'NCERT कक्षा 10 विज्ञान — प्रकाश, विद्युत, जीवन प्रक्रियाएँ। 20 प्रश्न।',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'अवतल दर्पण द्वारा बनाया गया प्रतिबिम्ब हो सकता है:',
        options: ['केवल वास्तविक', 'केवल आभासी', 'वास्तविक या आभासी', 'न वास्तविक न आभासी'],
        answerIndex: 2,
        bloom: 'understand',
      },
    ],
    tags: ['cbse', 'hindi medium', 'class 10', 'vigyan'],
    related: TEACHER_RELATED,
  }),
  'hindi-medium-class-9-ganit': makeTemplate({
    slug: 'hindi-medium-class-9-ganit',
    title: 'CBSE हिंदी माध्यम — कक्षा 9 गणित',
    audience: 'school-teachers',
    grade: 'class-9-10',
    subject: 'गणित (Hindi-medium Math)',
    shortDescription: 'NCERT कक्षा 9 गणित — संख्या प्रणाली, बहुपद, निर्देशांक ज्यामिति।',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: '√2 एक संख्या है:',
        options: ['परिमेय', 'अपरिमेय', 'पूर्णांक', 'भिन्न'],
        answerIndex: 1,
        bloom: 'understand',
      },
    ],
    tags: ['cbse', 'hindi medium', 'class 9', 'ganit'],
    related: TEACHER_RELATED,
  }),
  'hindi-current-affairs-upsc': makeTemplate({
    slug: 'hindi-current-affairs-upsc',
    title: 'UPSC समसामयिकी (Hindi) — साप्ताहिक प्रश्न',
    audience: 'coaching-institutes',
    grade: 'upsc',
    subject: 'समसामयिकी',
    shortDescription: 'UPSC साप्ताहिक समसामयिकी प्रश्न हिंदी में — योजनाएँ, अंतर्राष्ट्रीय संबंध, अर्थव्यवस्था।',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'पीएम विश्वकर्मा योजना का लक्ष्य है:',
        options: ['किसान', 'पारंपरिक कारीगर एवं शिल्पकार', 'MSME', 'स्टार्टअप'],
        answerIndex: 1,
        bloom: 'remember',
      },
    ],
    tags: ['upsc', 'current affairs', 'hindi'],
    related: COACHING_RELATED,
  }),
  'hindi-corporate-icebreaker': makeTemplate({
    slug: 'hindi-corporate-icebreaker',
    title: 'हिंदी कॉर्पोरेट टीम मीटिंग आइसब्रेकर',
    audience: 'corporate-trainers',
    grade: 'corporate',
    subject: 'Team Building',
    shortDescription: 'हिंदी-माध्यम corporate team meetings ke liye 12 icebreaker prashn.',
    totalQuestions: 12,
    sampleQuestions: [
      {
        question: 'काम के दिन सबसे अच्छा lunch — एक चुनिए:',
        options: ['पराठा-सब्जी', 'दाल-चावल', 'रोटी-सब्जी', 'बिरयानी'],
        answerIndex: 0,
      },
    ],
    tags: ['corporate', 'hindi', 'icebreaker'],
    related: CORPORATE_RELATED,
  }),
  'hindi-medium-class-8-ncert-vigyan': makeTemplate({
    slug: 'hindi-medium-class-8-ncert-vigyan',
    title: 'NCERT कक्षा 8 विज्ञान (हिंदी माध्यम)',
    audience: 'school-teachers',
    grade: 'class-6-8',
    subject: 'विज्ञान (Hindi-medium Science)',
    shortDescription: 'NCERT कक्षा 8 विज्ञान — सूक्ष्मजीव, प्रकाश, ध्वनि।',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'जीवाणु एक प्रकार के सूक्ष्मजीव हैं जो हैं:',
        options: ['एककोशिकीय', 'बहुकोशिकीय', 'विषाणु', 'कवक'],
        answerIndex: 0,
        bloom: 'remember',
      },
    ],
    tags: ['cbse', 'hindi medium', 'class 8', 'vigyan'],
    related: TEACHER_RELATED,
  }),

  // ============ Class 11-12 / Specialized (4) ============
  'class-11-physics-mechanics': makeTemplate({
    slug: 'class-11-physics-mechanics',
    title: 'CBSE Class 11 Physics — Mechanics',
    audience: 'school-teachers',
    grade: 'class-11-12',
    subject: 'Physics',
    shortDescription: '25 MCQs on Class 11 Mechanics — Kinematics, Laws of Motion, Work-Energy.',
    totalQuestions: 25,
    sampleQuestions: [
      {
        question: 'Dimensions of momentum are:',
        options: ['MLT⁻¹', 'MLT⁻²', 'ML²T⁻¹', 'ML⁻¹T⁻¹'],
        answerIndex: 0,
        bloom: 'remember',
      },
    ],
    tags: ['cbse', 'class 11', 'physics'],
    related: TEACHER_RELATED,
  }),
  'class-12-chemistry-coordination': makeTemplate({
    slug: 'class-12-chemistry-coordination',
    title: 'CBSE Class 12 Chemistry — Coordination Compounds',
    audience: 'school-teachers',
    grade: 'class-11-12',
    subject: 'Chemistry',
    shortDescription: '20 MCQs on Coordination Compounds — IUPAC nomenclature, isomerism, CFT.',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'Coordination number of cobalt in [Co(NH₃)₆]Cl₃ is:',
        options: ['3', '6', '9', '4'],
        answerIndex: 1,
        bloom: 'understand',
      },
    ],
    tags: ['cbse', 'class 12', 'chemistry'],
    related: TEACHER_RELATED,
  }),
  'class-12-biology-genetics': makeTemplate({
    slug: 'class-12-biology-genetics',
    title: 'CBSE Class 12 Biology — Heredity & Variation',
    audience: 'school-teachers',
    grade: 'class-11-12',
    subject: 'Biology',
    shortDescription: '20 MCQs on Heredity, Mendel\'s laws, Inheritance patterns.',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'Mendel\'s Law of Independent Assortment applies when genes are:',
        options: ['On the same chromosome', 'On different chromosomes', 'Linked', 'Sex-linked'],
        answerIndex: 1,
        bloom: 'understand',
      },
    ],
    tags: ['cbse', 'class 12', 'biology', 'genetics'],
    related: TEACHER_RELATED,
  }),
  'class-12-math-vectors': makeTemplate({
    slug: 'class-12-math-vectors',
    title: 'CBSE Class 12 Math — Vectors & 3D Geometry',
    audience: 'school-teachers',
    grade: 'class-11-12',
    subject: 'Math',
    shortDescription: '20 MCQs on Vectors and 3D Geometry — dot product, cross product, line/plane equations.',
    totalQuestions: 20,
    sampleQuestions: [
      {
        question: 'If a·b = 0 and neither a nor b is zero, then:',
        options: ['a = b', 'a ⊥ b', 'a ∥ b', 'a = -b'],
        answerIndex: 1,
        bloom: 'understand',
      },
    ],
    tags: ['cbse', 'class 12', 'math', 'vectors'],
    related: TEACHER_RELATED,
  }),
}

export const TEMPLATE_SLUGS = Object.keys(TEMPLATES)

export const TEMPLATE_AUDIENCES: Record<TemplateAudience, { label: string; description: string }> = {
  'school-teachers': {
    label: 'School teachers',
    description: 'CBSE, ICSE, and NCERT-aligned templates for K-12 classroom use.',
  },
  'coaching-institutes': {
    label: 'Coaching institutes',
    description: 'JEE, NEET, UPSC, and competitive exam prep templates.',
  },
  'corporate-trainers': {
    label: 'Corporate trainers',
    description: 'Onboarding, compliance, sales, and L&D quiz templates.',
  },
  'event-hosts': {
    label: 'Event hosts',
    description: 'Trivia nights, conferences, audience polls, town halls.',
  },
  colleges: {
    label: 'Colleges',
    description: 'Higher-ed lecture polls, recap quizzes, MBA, engineering templates.',
  },
}

export const TEMPLATE_GRADES: Record<TemplateGrade, string> = {
  'class-6-8': 'Class 6–8',
  'class-9-10': 'Class 9–10',
  'class-11-12': 'Class 11–12',
  'jee-neet': 'JEE / NEET',
  upsc: 'UPSC',
  corporate: 'Corporate',
  general: 'General',
}
