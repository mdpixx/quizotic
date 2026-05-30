# Quizotic Grant and Platform Application Materials

Canonical facts used in this file:

- Product: Quizotic, a free live quiz and presentation platform for Indian education and corporate training.
- Website: https://quizotic.live
- Founder: Mahesh Dhiman, Sr. Manager L&D at IndianOil, building nights and weekends in India.
- Stage: MVP launched, pre-revenue, pre-seed.
- Stack: Next.js, Prisma, PostgreSQL on Railway, WebSockets/Socket.io for real-time sync, AI quiz generation, 19 slide types, Bloom's Taxonomy engine, UPI billing.

## Section 1: Microsoft for Startups Founders Hub Application

### Company Description

Quizotic is a free live quiz and presentation platform built for Indian classrooms, coaching institutes, colleges, and corporate training teams. Trainers and educators in India often run interactive sessions with tools that were designed for Western pricing, high-bandwidth environments, and generic audience engagement use cases. The result is a fragmented workflow: slides in one tool, quizzes in another, learner responses in chat, and post-session analysis in spreadsheets. For schools and smaller training teams, paid global tools are often difficult to justify. For corporate L&D teams, the problem is not only cost, but the lack of pedagogy-aware quiz creation, Indian payment flows, and reliable live participation on mobile-first networks.

The gap is especially visible in live sessions, where engagement must happen in seconds. If the join flow is heavy, the interface is confusing, or the network drops, the trainer loses the room. Quizotic is being built around that constraint from the beginning.

Quizotic solves this by combining live quizzes, interactive presentations, AI-assisted quiz creation, and learning design into one browser-based product. A host can create a session, generate or edit questions, add presentation slides, run the session live, and let participants join instantly without installing an app. The platform currently supports 19 slide types and real-time synchronization through WebSockets so participants stay aligned with the host. Its AI quiz generator helps trainers move faster from topic to assessment, while the Bloom's Taxonomy engine helps structure questions across cognitive levels instead of producing only recall-based quizzes. Quizotic is intentionally India-first: INR and UPI billing are part of the product direction, the participant experience is mobile-first, and the architecture is designed for low-bandwidth classroom conditions.

The target market has two strong entry points. The first is education: schools, coaching centers, colleges, independent teachers, and edtech operators who need affordable engagement and assessment tools. The second is corporate training: L&D teams, HR trainers, internal faculty, safety instructors, and compliance trainers who need live knowledge checks, induction programs, refresher assessments, and participant reports. Founder Mahesh Dhiman has direct founder-market fit from his role as Sr. Manager L&D at IndianOil, where he understands the operational realities of training large, distributed learner groups in India.

Quizotic has launched its MVP at quizotic.live and is currently pre-revenue. Early traction is product traction: the platform has moved from concept to a working public MVP with host workflows, live sessions, AI generation, presentation capability, and real-time participant sync. The current focus is to improve onboarding, reliability, session analytics, and the free-to-paid path before scaling outreach to educators and training teams.

The product is built with Next.js, Prisma, PostgreSQL, and a custom Node.js server using Socket.io/WebSockets for real-time sync. It is currently deployed on Railway, with database-backed persistence and a browser-first experience. The next technical milestone is to harden the platform for higher concurrency, add stronger AI generation and evaluation features, create scalable reporting for educators and corporate trainers, and validate repeatable use cases through early pilots with individual teachers, institutional trainers, and small L&D teams.

### Why Microsoft

Microsoft is a strong fit because Quizotic sits at the intersection of education, workplace learning, real-time collaboration, and applied AI. Azure credits would allow the platform to move beyond a small MVP deployment and test a production-grade architecture using Azure App Service or Container Apps, Azure Database for PostgreSQL, Blob Storage for media, Application Insights for observability, and CDN/edge delivery for low-latency participation across India. Azure OpenAI and OpenAI startup credits would directly accelerate the AI quiz generator, Bloom's Taxonomy question classification, content-to-assessment workflows, and multilingual support for Indian classrooms and training teams. Microsoft also has deep credibility with schools, enterprises, and government-linked institutions, which aligns with Quizotic's education and corporate L&D focus. Founders Hub would help convert a bootstrapped, nights-and-weekends MVP into a more reliable, measurable platform ready for pilots, usage analytics, enterprise security expectations, procurement conversations, and eventual institutional adoption.

### Stage

Launch: pre-seed, MVP launched, pre-revenue.

## Section 2: AWS Activate Application

### Company Description

Quizotic is a free live quiz and presentation platform for Indian education and corporate training. It helps teachers, trainers, and L&D teams run interactive learning sessions without forcing participants to install an app or depend on expensive global tools. In many Indian classrooms and training rooms, engagement still happens through a mix of PowerPoint, WhatsApp, Google Forms, chat messages, and manual scoring. This creates friction for hosts and a weak learning loop for participants. It also leaves trainers without structured data on who understood the concept, which questions failed, or whether the session achieved its learning objective.

The problem is practical, not theoretical. A trainer may have only 45 minutes, dozens of learners, mixed devices, and uneven connectivity. The tool has to be fast enough for the room, simple enough for first-time participants, and structured enough to produce useful learning signals.

The product brings the quiz, presentation, and live audience experience into one browser-based platform. A host can create a quiz or presentation, use AI to generate questions from a topic, design assessment using Bloom's Taxonomy, and run a synchronized live session where participants answer from their phones. Quizotic includes 19 slide types, real-time host-participant sync, AI quiz generation, and an India-first payments direction with INR and UPI billing. The platform is built to support practical Indian use cases: classrooms where learners join on mobile data, coaching centers that need speed and affordability, colleges running classroom engagement, and corporate trainers conducting induction, safety, product, compliance, and refresher training.

Quizotic's target customers are Indian educators and training teams who need a lighter, more affordable alternative to international audience engagement platforms. The education segment includes schools, coaching institutes, colleges, independent teachers, and edtech creators. The corporate segment includes L&D, HR, sales enablement, operations training, and internal faculty teams. The founder, Mahesh Dhiman, is a Sr. Manager L&D at IndianOil, which gives Quizotic direct insight into the problems of training at scale in India: limited learner attention, mixed device quality, bandwidth constraints, and the need to connect learning activities to measurable outcomes.

Quizotic is currently at MVP launch stage and pre-revenue. The product is live at quizotic.live and already includes the foundation required for a real-time SaaS platform: quiz creation, presentation flows, AI generation, live participation, WebSocket sync, and database-backed persistence. The immediate goal is to increase reliability, improve session creation, test early educator and trainer cohorts, and prepare the infrastructure for higher concurrency.

The current stack is Next.js, Prisma, PostgreSQL, and a custom Node.js server using Socket.io/WebSockets. It is deployed on Railway today. AWS Activate would help Quizotic mature from a single bootstrapped deployment into a scalable cloud architecture using managed compute, managed PostgreSQL, observability, object storage, CDN, queueing, and AI/ML services. The product's technical needs fit AWS well because the core experience depends on real-time sync, low latency, elastic usage during live sessions, cost-controlled AI generation, and resilient infrastructure for classrooms and enterprise training cohorts that may join at the same time.

### Why AWS Credits Would Help

Quizotic is currently deployed on Railway because it is fast and founder-friendly for an MVP. AWS credits would let the platform test and migrate critical production workloads without increasing burn before revenue. Credits could support Amazon RDS for PostgreSQL, ECS or App Runner for the Next.js and Socket.io server, ElastiCache for session state and real-time scaling, CloudFront and S3 for static/media delivery, CloudWatch for observability, and AWS WAF/IAM controls for safer production operation. For AI/ML, Amazon Bedrock could be used to compare foundation models for quiz generation, taxonomy classification, rubric creation, multilingual content generation, and future learning analytics. Activate support would also help design cost controls before usage spikes. For a bootstrapped Indian founder building an education and L&D platform nights and weekends, AWS credits would convert cloud cost from a limiting factor into a structured experimentation budget and make larger pilot sessions feasible earlier.

### Stage

Launch: pre-seed, MVP launched, pre-revenue.

## Section 3: YC Launch Listing

### Company Name

Quizotic

### One-Liner

Free live quiz and presentation platform for Indian trainers.

### Description

Quizotic lets teachers and corporate trainers create AI-assisted quizzes, interactive slides, and live sessions that participants join from their phones. It is built India-first with real-time sync, Bloom's Taxonomy question design, and UPI-ready billing.

### Industry

Education

### Tags

SaaS, AI, India, Real-time

## Section 4: Peerlist Project Listing

### Project Name

Quizotic

### Tagline

AI-powered live quizzes and presentations for Indian classrooms and training rooms.

### Description

Quizotic is a free live quiz and presentation platform for Indian education and corporate training. Hosts can generate quizzes with AI, build interactive slide-based sessions, and run real-time participation from any browser. It is built for mobile-first learners, low-bandwidth rooms, and India-first workflows like INR/UPI billing.

### Tech Stack Tags

Next.js, React, TypeScript, Prisma, PostgreSQL, Socket.io, WebSockets, Railway, AI, UPI, SaaS

### What I Built It With

Quizotic is built with Next.js App Router for the web application, a custom Node.js server for Socket.io real-time sync, Prisma as the ORM, PostgreSQL for persistence, and Railway for deployment. The product includes an AI quiz generator, a Bloom's Taxonomy engine, 19 slide types, host and participant flows, and India-first billing architecture with UPI in mind.

### Challenges Faced

The hardest part was designing a live learning experience that feels simple for participants but remains powerful for hosts. Real-time sessions need reliable host-participant synchronization, small payloads, mobile-friendly screens, and low-bandwidth behavior. The product also has to balance speed of quiz creation with educational quality, which is why the AI generator is paired with Bloom's Taxonomy instead of only generating generic questions.

### What's Next

Next steps are improving onboarding, strengthening the quiz creation journey, adding richer reports for hosts, testing early educator and trainer cohorts, and hardening infrastructure for larger live sessions. Longer term, Quizotic will add stronger AI-assisted content workflows, multilingual support, team workspaces, and paid plans for institutions and corporate L&D teams.

## Section 5: NASSCOM DeepTech / Startup India Grant Pitch

### Problem Statement

India has a large and growing need for practical digital learning infrastructure, but everyday classroom and training engagement remains fragmented. Teachers, coaching faculty, college instructors, and corporate trainers often rely on slides, chat, forms, and manual scoring to run interactive sessions. Global tools such as quiz and audience-engagement platforms exist, but they are usually priced and designed for markets with higher SaaS willingness to pay, more predictable connectivity, and less need for India-specific workflows. For Indian educators and trainers, this creates three problems. First, session creation is slow because content, quizzes, slides, and reports are handled across multiple tools. Second, learner engagement data is weak because responses are not always tied to learning objectives or cognitive levels. Third, adoption is limited because many participants join from mobile phones on uneven networks, and many institutions prefer simple INR/UPI-aligned procurement. Corporate L&D faces the same issue at scale: training is frequent, but measurable live knowledge checks are still hard to deploy consistently across induction, compliance, safety, product, and refresher programs. Existing LMS products store courses, but they rarely make the live training room more interactive, measurable, or easier to run for facilitators under time pressure.

### Solution and Innovation

Quizotic is a browser-based live quiz and presentation platform designed specifically for Indian education and corporate training. It combines interactive slide delivery, live quiz participation, AI-assisted quiz creation, and Bloom's Taxonomy-based question design in one product. Hosts can create a session, generate or edit assessment content, run the session live, and collect participant responses without requiring learners to install an app. The innovation is not only in using AI to generate questions, but in connecting generation to pedagogy and live delivery. The Bloom's Taxonomy engine helps educators structure questions across levels such as recall, understanding, application, and analysis, making the output more useful for real teaching and training. Real-time WebSocket synchronization keeps the classroom or training room aligned, while the mobile-first participant experience supports Indian usage conditions. The platform is built with Next.js, Prisma, PostgreSQL, and Socket.io, and is currently live as an MVP. Over time, Quizotic can become an India-first learning interaction layer across schools, coaching centers, colleges, edtech providers, and enterprise L&D teams. Future innovation will add multilingual generation, richer analytics, reusable session templates, and institution-ready exports for common Indian education and L&D workflows.

### Market Opportunity

India's edtech and workforce learning markets are large enough to support a focused, India-first SaaS product. IBEF cites an IAMAI and Grant Thornton Bharat report projecting India's edtech market to grow from about US$7.5 billion to about US$29 billion by 2030, driven by online education adoption and expansion into tier II and tier III cities. IMARC estimates India's corporate training market reached US$12.2 billion in 2025, with continued growth expected through 2034. These markets are usually discussed separately, but Quizotic sits in the overlap: live instruction, assessment, engagement, and learning analytics. The initial wedge is not to compete with full LMS platforms or content companies. Instead, Quizotic focuses on the high-frequency session layer used by teachers, trainers, and facilitators every day. The same workflow can serve a school teacher running a science quiz, a coaching institute conducting revision, a college professor checking comprehension, or an L&D manager running safety training. This gives Quizotic a practical route to adoption: free individual use, then paid institutional features such as reports, team workspaces, branding, larger sessions, analytics, and billing.

Market references:

- IBEF on India edtech market projection: https://www.ibef.org/news/india-s-edtech-market-likely-to-reach-rs-2-50-850-crore-us-29-billion-by-2030-report
- IMARC on India corporate training market: https://www.imarcgroup.com/india-corporate-training-market
- Microsoft for Startups benefits reference: https://learn.microsoft.com/en-us/startups/microsoft-for-startups/overview
- AWS Activate credits reference: https://aws.amazon.com/startups/credits

### Why Grant Funding Would Accelerate

Grant funding would accelerate Quizotic at the exact stage where a technically working MVP needs structured validation, reliability, and adoption support. The platform is currently bootstrapped by Mahesh Dhiman, a 41-year-old Sr. Manager L&D at IndianOil, building nights and weekends while supporting a family. This creates strong capital efficiency, but it also limits the speed of infrastructure hardening, AI experimentation, user research, and outreach. A grant would be used to improve production reliability for live sessions, expand AI quiz generation and Bloom's Taxonomy workflows, run pilots with educators and corporate trainers, improve reporting and analytics, and cover cloud and model costs while the product remains free for early users. It would also support India-specific localization, low-bandwidth testing, and UPI-led billing readiness. The grant would not fund a speculative idea; it would help convert a launched MVP into a pilot-ready platform with measurable usage, stronger technical resilience, and a clearer path to sustainable SaaS revenue.
