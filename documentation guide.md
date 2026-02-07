# The Complete Guide to AI-First Documentation for Building Apps

## Introduction

This guide provides best practices and detailed prompts for generating the six canonical documents that form your project’s knowledge base before writing any code. Each document serves a specific purpose in eliminating AI hallucinations and ensuring consistent, predictable builds.

-----

## Document 1: PRD.md (Product Requirements Document)

### Purpose

Your contract with AI. Defines **what** you’re building, **who** it’s for, and **what success looks like**. No ambiguity allowed.

### Best Practices from Research

- Start with user goals and problems, not features
- Include explicit out-of-scope items to prevent scope creep
- Use SMART criteria for success metrics (Specific, Measurable, Achievable, Relevant, Time-bound)
- Keep it concise but comprehensive (modern PRDs are blog-post length, not 37-page docs)
- Make it a living document that evolves with the product
- Use clear, specific language—avoid vague terms
- Include user stories in “As a [user], I want [goal], so that [benefit]” format

### Structure Template

```
# Product Requirements Document (PRD)

## 1. Product Overview
- **Project Title**: [Name]
- **Version**: 1.0
- **Last Updated**: [Date]
- **Owner**: [Name]

## 2. Problem Statement
[What user/business problem are you solving? Be specific.]

## 3. Goals & Objectives
### Business Goals
- [Goal 1 with metric]
- [Goal 2 with metric]

### User Goals
- [What users want to accomplish]

## 4. Success Metrics
- [Metric 1]: [Target]
- [Metric 2]: [Target]
- [How you'll measure success]

## 5. Target Users & Personas
### Primary Persona: [Name]
- **Demographics**: 
- **Pain Points**: 
- **Goals**: 
- **Technical Proficiency**: 

### Secondary Persona: [Name]
[Same format]

## 6. Features & Requirements
### Must-Have Features (P0)
1. **[Feature Name]**
   - Description: [What it does]
   - User Story: As a [user], I want [goal] so that [benefit]
   - Acceptance Criteria:
     - [ ] [Specific, testable criterion]
     - [ ] [Specific, testable criterion]
   - Success Metric: [How you measure this feature's success]

2. [Repeat for each P0 feature]

### Should-Have Features (P1)
[Same format]

### Nice-to-Have Features (P2)
[Same format]

## 7. Explicitly OUT OF SCOPE
- [Thing 1 you will NOT build]
- [Thing 2 you will NOT build]
[This section is critical—prevents AI from adding features you never requested]

## 8. User Scenarios
### Scenario 1: [Name]
- **Context**: [When does this happen?]
- **Steps**: 
  1. [User action]
  2. [System response]
  3. [User action]
- **Expected Outcome**: [What success looks like]
- **Edge Cases**: [What could go wrong?]

## 9. Dependencies & Constraints
- **Technical Constraints**: [Platform limits, API restrictions, etc.]
- **Business Constraints**: [Budget, timeline, team size]
- **External Dependencies**: [Third-party services, APIs]

## 10. Timeline & Milestones
- **MVP**: [Date] - [Features included]
- **V1.0**: [Date] - [Features included]

## 11. Risks & Assumptions
### Risks
- [Risk 1 and mitigation strategy]

### Assumptions
- [Assumption 1 and validation plan]

## 12. Non-Functional Requirements
- **Performance**: [Load time, concurrent users]
- **Security**: [Authentication, data protection]
- **Accessibility**: [WCAG compliance level]
- **Scalability**: [Expected growth]

## 13. References & Resources
- [Links to research, competitor analysis, user interviews]
```

### Sample AI Prompt for PRD Generation

```
Create a comprehensive Product Requirements Document (PRD) for [YOUR APP IDEA].

Context:
- Target Users: [WHO]
- Main Problem: [WHAT PROBLEM]
- Unique Value: [WHY THIS SOLUTION]

Structure the PRD with these sections:

1. PROBLEM STATEMENT
Write a clear, specific problem statement that describes the user pain point or business need.

2. GOALS & OBJECTIVES
Define 3-5 SMART goals with specific, measurable targets.

3. SUCCESS METRICS
Identify 3-5 quantifiable metrics to measure success (e.g., "30% reduction in task completion time").

4. TARGET PERSONAS
Create 2 detailed user personas with:
- Demographics
- Pain points
- Goals
- Technical proficiency level

5. FEATURES & REQUIREMENTS
Organize features into three tiers:
- P0 (Must-Have): Core features required for MVP
- P1 (Should-Have): Important but not critical for launch
- P2 (Nice-to-Have): Future enhancements

For each feature, include:
- Clear description
- User story format: "As a [user], I want [goal] so that [benefit]"
- 3-5 acceptance criteria (specific, testable)
- Success metric

6. EXPLICITLY OUT OF SCOPE
List 5-10 things you will NOT build in this version. Be specific.

7. USER SCENARIOS
Create 3 detailed end-to-end scenarios showing:
- Context (when does this happen)
- Step-by-step user actions and system responses
- Expected outcomes
- Edge cases and error handling

8. NON-FUNCTIONAL REQUIREMENTS
Specify performance, security, accessibility, and scalability requirements.

9. DEPENDENCIES & CONSTRAINTS
List technical and business constraints, external dependencies (APIs, services).

10. TIMELINE
Define MVP and V1.0 milestone dates with included features.

CRITICAL REQUIREMENTS:
- Use specific, measurable criteria (not vague)
- Avoid technical implementation details
- Focus on WHAT to build, not HOW to build it
- Make every requirement testable
- Include edge cases and error states
- Be explicit about what's NOT included

OUTPUT FORMAT: Markdown document with clear headers and bullet points.
```

-----

## Document 2: APP_FLOW.md (Application Flow & Navigation)

### Purpose

Maps every page, every user path, every decision point. Prevents AI from guessing navigation patterns.

### Best Practices from Research

- Start with user goals, not pages
- Document entry points explicitly (how users arrive)
- Show decision points and branching logic
- Include success paths AND error states
- Keep flows focused on single goals (one flow per task)
- Use visual flowchart standards (shapes have meaning)
- Document what triggers each flow

### Structure Template

```
# Application Flow Documentation

## 1. Entry Points
### Primary Entry Points
- **Direct URL**: [What happens when user types URL]
- **Landing Page**: [What the user sees first]
- **Deep Links**: [From email, notifications, ads]
- **OAuth/Social Login**: [Third-party entry points]

### Secondary Entry Points
- **Search Engine**: [SEO landing pages]
- **Marketing Campaigns**: [Campaign-specific entry]

## 2. Core User Flows

### Flow 1: [Flow Name - e.g., "User Registration"]
**Goal**: [What user is trying to accomplish]
**Entry Point**: [Where flow starts]
**Frequency**: [How often this happens]

#### Happy Path
1. **Page: Landing Page**
   - Elements: [Hero section, CTA button]
   - User Action: Clicks "Sign Up"
   - Trigger: Navigate to registration page
   
2. **Page: Registration Form**
   - Elements: [Email input, Password input, Submit button]
   - User Actions: 
     - Enters email
     - Enters password (with validation)
   - Validation: 
     - Email format check
     - Password strength requirements
   - Trigger: Submits form
   
3. **System Action**: Creates user account
   
4. **Page: Email Verification**
   - Elements: [Verification message, Resend link]
   - User Action: Clicks verification link in email
   
5. **Page: Welcome Dashboard**
   - Elements: [Onboarding checklist, Quick actions]
   - Success State: User is logged in and onboarded

#### Error States
- **Invalid Email**
  - Display: Inline error message
  - Action: User corrects and resubmits
  
- **Email Already Exists**
  - Display: Modal with login link
  - Action: Redirect to login
  
- **Weak Password**
  - Display: Password strength indicator
  - Action: User strengthens password

#### Edge Cases
- User closes browser mid-registration → Save form data, show "Continue" on return
- Email verification link expires → Provide resend option
- User registers but doesn't verify → Send reminder after 24 hours

#### Exit Points
- Success: Dashboard (logged in)
- Abandonment: Close/navigate away
- Redirect: Login page if account exists

---

### Flow 2: [Flow Name - e.g., "Product Purchase"]
[Same detailed structure]

---

## 3. Navigation Map

### Primary Navigation
```

Home
├── Products
│   ├── Category 1
│   │   └── Product Detail
│   │       ├── Add to Cart
│   │       └── Reviews
│   └── Category 2
├── Cart
│   ├── Checkout
│   │   ├── Shipping Info
│   │   ├── Payment
│   │   └── Order Confirmation
│   └── Continue Shopping → Products
├── Account
│   ├── Profile
│   ├── Orders
│   └── Settings
└── Support

```
### Navigation Rules
- **Authentication Required**: [Pages that require login]
- **Redirect Logic**: [When to redirect to login, when to show modal]
- **Back Button Behavior**: [Which pages preserve state]

## 4. Screen Inventory

### Screen: [Screen Name]
- **Route**: `/path/to/screen`
- **Access**: [Public/Authenticated/Admin]
- **Purpose**: [What user accomplishes here]
- **Key Elements**: 
  - [Element 1]
  - [Element 2]
- **Actions Available**:
  - [Action 1] → Leads to [Screen/State]
  - [Action 2] → Leads to [Screen/State]
- **State Variants**: [Loading, Empty, Error, Success]

## 5. Interaction Patterns

### Pattern: Form Submission
- Validation: Client-side (instant) + Server-side (on submit)
- Loading State: Disabled button, spinner
- Success: Redirect OR inline success message
- Error: Inline error messages, keep form data

### Pattern: Infinite Scroll
- Trigger: User scrolls to 80% of page
- Loading: Skeleton screens
- End: "No more items" message

## 6. Decision Points

### Decision: User Authentication Status
```

IF user is NOT logged in
THEN show: Login CTA
AND disable: Account features
ELSE IF user IS logged in
THEN show: Account menu
AND enable: Full features

```
### Decision: Cart State
```

IF cart is empty
THEN show: “Start Shopping” CTA
ELSE IF cart has items
THEN show: Checkout button
AND display: Item count badge

```
## 7. Error Handling Flows

### 404 Not Found
- Display: Custom 404 page
- Actions: Search, Home link, Popular pages
- Log: 404 errors for fixing broken links

### 500 Server Error
- Display: Friendly error page
- Actions: Retry button, Support contact
- Fallback: Save user's work if possible

### Network Offline
- Display: Offline banner
- Actions: Queue actions for later
- Recovery: Auto-retry when online

## 8. Responsive Behavior

### Mobile-Specific Flows
- Navigation: Hamburger menu instead of top nav
- Forms: One field per screen
- Actions: Bottom sheet for selections

### Desktop-Specific Flows
- Navigation: Full menu visible
- Forms: Multi-column layouts
- Actions: Modals for quick actions

## 9. Animation & Transitions

### Page Transitions
- **Navigation**: Fade in/out (300ms)
- **Modal**: Slide up from bottom (200ms)
- **Drawer**: Slide from side (250ms)

### Micro-interactions
- **Button Click**: Scale(0.95) + Ripple
- **Form Focus**: Border highlight
- **Success**: Checkmark animation
```

### Sample AI Prompt for APP_FLOW Generation

```
Create comprehensive Application Flow documentation (APP_FLOW.md) for [YOUR APP NAME].

Context:
[Provide brief description of app]

Generate documentation with these sections:

1. ENTRY POINTS
List all ways users can enter the app:
- Direct URL access
- Deep links (email, notifications)
- OAuth/social login
- Search engines
- Marketing campaigns

2. CORE USER FLOWS
For each major user task, create a detailed flow:

Required Flows:
- User onboarding/registration
- Main feature usage (e.g., create post, make purchase, book appointment)
- Account management
- Error recovery

For EACH flow, document:

**HAPPY PATH** (Step-by-step):
- Page/Screen name
- UI elements present
- User actions (clicks, inputs)
- System responses
- Validation rules
- Next page/state
- Success criteria

**ERROR STATES** (What can go wrong):
- Invalid inputs (how they're handled)
- System errors (display and recovery)
- Timeout scenarios
- Offline behavior

**EDGE CASES**:
- User abandons flow
- User goes back
- Concurrent actions
- Session expiry

3. NAVIGATION MAP
Create a hierarchical tree showing:
- Main navigation structure
- Sub-pages and nesting
- Cross-links between sections
- Authentication requirements per page

4. SCREEN INVENTORY
For each unique screen/page, specify:
- URL/Route
- Access level (public/authenticated/admin)
- Purpose
- Key UI elements
- Available actions → where they lead
- State variants (loading, empty, error, success)

5. DECISION POINTS
Document every conditional in the flow using IF-THEN logic:
```

IF [condition]
THEN [action/display]
ELSE IF [condition]
THEN [action/display]
ELSE
THEN [default action]

```
Examples:
- Authentication checks
- Feature availability
- Permission levels
- Cart/basket state
- Form validation

6. ERROR HANDLING
Document flows for:
- 404 errors
- 500 errors
- Network offline
- Permission denied
- Form validation failures

For each: Display shown, user actions available, system recovery

7. RESPONSIVE BEHAVIOR
Specify how flows differ on:
- Mobile (touch interactions, simplified nav)
- Tablet
- Desktop (full features)

8. ANIMATIONS & TRANSITIONS
Document:
- Page transitions (duration, easing)
- Modal/drawer behavior
- Loading states
- Success animations

CRITICAL REQUIREMENTS:
- Every user action must have a clear next step
- Document BOTH success and failure paths
- Include specific validation rules
- Specify error message wording
- Show state transitions explicitly
- Use consistent naming (match PRD.md features)

OUTPUT FORMAT: Markdown with clear headers, indented lists for hierarchy, code blocks for decision logic.
```

-----

## Document 3: TECH_STACK.md (Technology Stack)

### Purpose

Locks every dependency, tool, and version. Zero ambiguity on what to use.

### Best Practices from Research

- Specify EXACT versions (not “latest”)
- Document WHY each choice was made
- Include setup/installation instructions
- List compatibility requirements
- Track security considerations
- Maintain version control practices
- Document update/upgrade policies

### Structure Template

```
# Technology Stack Documentation

## 1. Stack Overview
**Last Updated**: [Date]
**Version**: 1.0

### Architecture Pattern
- **Type**: [Monolithic/Microservices/Serverless]
- **Pattern**: [MVC/MVVM/JAMstack]
- **Deployment**: [Cloud/On-premise/Hybrid]

---

## 2. Frontend Stack

### Core Framework
- **Framework**: Next.js
- **Version**: 14.1.0
- **Reason**: Server-side rendering, file-based routing, built-in optimization
- **Documentation**: https://nextjs.org/docs
- **License**: MIT

### UI Library
- **Library**: React
- **Version**: 18.2.0
- **Reason**: Component-based architecture, large ecosystem
- **Documentation**: https://react.dev
- **License**: MIT

### State Management
- **Library**: Zustand
- **Version**: 4.4.7
- **Reason**: Lightweight, TypeScript-first, minimal boilerplate
- **Documentation**: https://github.com/pmndrs/zustand
- **License**: MIT
- **Alternatives Considered**: Redux (rejected: too verbose), Context API (rejected: performance)

### Styling
- **Framework**: Tailwind CSS
- **Version**: 3.4.1
- **Configuration**: Custom config at `tailwind.config.js`
- **Reason**: Utility-first, fast development, consistent design
- **Documentation**: https://tailwindcss.com/docs
- **License**: MIT

### Type Safety
- **Language**: TypeScript
- **Version**: 5.3.3
- **tsconfig**: Strict mode enabled
- **Reason**: Type safety, better IDE support, fewer runtime errors

### Form Handling
- **Library**: React Hook Form
- **Version**: 7.49.3
- **Validation**: Zod 3.22.4
- **Reason**: Performance, minimal re-renders, TypeScript support

### HTTP Client
- **Library**: Axios
- **Version**: 1.6.5
- **Interceptors**: Auth token injection, error handling
- **Reason**: Request/response interceptors, better error handling than fetch

### Routing
- **Built-in**: Next.js App Router
- **Version**: 14.1.0 (Next.js version)
- **Structure**: File-based routing with server components

---

## 3. Backend Stack

### Runtime
- **Platform**: Node.js
- **Version**: 20.11.0 LTS
- **Package Manager**: pnpm 8.14.1
- **Reason**: Performance, modern features, long-term support

### Framework
- **Framework**: Express.js
- **Version**: 4.18.2
- **Middleware**: 
  - cors@2.8.5
  - helmet@7.1.0 (security headers)
  - morgan@1.10.0 (logging)
  - express-rate-limit@7.1.5
- **Reason**: Mature, flexible, large ecosystem

### Database
- **Primary**: PostgreSQL
- **Version**: 16.1
- **ORM**: Prisma 5.8.1
- **Connection Pooling**: PgBouncer
- **Reason**: ACID compliance, JSON support, mature

#### Schema Management
- **Migrations**: Prisma Migrate
- **Seeding**: Prisma Seed scripts
- **Backup Strategy**: Daily automated backups

### Caching
- **System**: Redis
- **Version**: 7.2.4
- **Client**: ioredis 5.3.2
- **Use Cases**: Session storage, API caching, rate limiting
- **TTL Strategy**: 1 hour for API cache, 7 days for sessions

### Authentication
- **Strategy**: JWT (JSON Web Tokens)
- **Library**: jsonwebtoken 9.0.2
- **Hashing**: bcrypt 5.1.1 (12 rounds)
- **Token Expiry**: Access (15 min), Refresh (7 days)
- **Storage**: HTTP-only cookies

### File Storage
- **Service**: AWS S3
- **SDK**: @aws-sdk/client-s3 3.490.0
- **CDN**: CloudFront
- **Reason**: Scalable, reliable, cost-effective

### Email Service
- **Provider**: Resend
- **Library**: resend 3.0.0
- **Templates**: React Email
- **Reason**: Developer-friendly, reliable delivery

---

## 4. DevOps & Infrastructure

### Version Control
- **System**: Git
- **Platform**: GitHub
- **Branch Strategy**: 
  - `main` (production)
  - `develop` (staging)
  - `feature/*` (features)
  - `hotfix/*` (urgent fixes)

### CI/CD
- **Platform**: GitHub Actions
- **Workflows**: 
  - PR checks (lint, type-check, tests)
  - Deploy to staging (on merge to develop)
  - Deploy to production (on merge to main)

### Hosting
- **Frontend**: Vercel
- **Backend**: Railway / Fly.io
- **Database**: Supabase / Railway
- **Reason**: Easy deployment, auto-scaling, edge network

### Monitoring
- **Error Tracking**: Sentry
- **Version**: @sentry/nextjs 7.99.0
- **Analytics**: Vercel Analytics
- **Logging**: Better-logging 4.1.0

### Testing
- **Unit Tests**: Vitest 1.2.0
- **Integration**: Supertest 6.3.4
- **E2E**: Playwright 1.41.1
- **Coverage Target**: 80%

---

## 5. Development Tools

### Code Quality
- **Linter**: ESLint 8.56.0
  - Config: eslint-config-next 14.1.0
- **Formatter**: Prettier 3.2.4
  - Config: .prettierrc.json
- **Git Hooks**: Husky 8.0.3
  - Pre-commit: Lint + Format
  - Pre-push: Tests

### IDE Recommendations
- **Editor**: VS Code
- **Extensions**: 
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - Prisma

---

## 6. Environment Variables

### Required Variables
```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_DATABASE_URL="postgresql://..." # For migrations

# Auth
JWT_SECRET="..." # 32+ character random string
JWT_REFRESH_SECRET="..."

# AWS S3
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
AWS_BUCKET_NAME="..."

# Email
RESEND_API_KEY="..."
FROM_EMAIL="noreply@..."

# App
NEXT_PUBLIC_API_URL="http://localhost:3001"
NODE_ENV="development"
```

-----

## 7. Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "format": "prettier --write .",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:e2e": "playwright test",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio",
    "db:seed": "ts-node prisma/seed.ts"
  }
}
```

-----

## 8. Dependencies Lock

### Frontend Dependencies

```json
{
  "next": "14.1.0",
  "react": "18.2.0",
  "react-dom": "18.2.0",
  "typescript": "5.3.3",
  "tailwindcss": "3.4.1",
  "zustand": "4.4.7",
  "react-hook-form": "7.49.3",
  "zod": "3.22.4",
  "axios": "1.6.5",
  "@tanstack/react-query": "5.17.19",
  "lucide-react": "0.312.0"
}
```

### Backend Dependencies

```json
{
  "express": "4.18.2",
  "@prisma/client": "5.8.1",
  "prisma": "5.8.1",
  "jsonwebtoken": "9.0.2",
  "bcrypt": "5.1.1",
  "cors": "2.8.5",
  "helmet": "7.1.0",
  "morgan": "1.10.0",
  "express-rate-limit": "7.1.5",
  "ioredis": "5.3.2",
  "@aws-sdk/client-s3": "3.490.0",
  "resend": "3.0.0"
}
```

-----

## 9. Security Considerations

### Authentication

- JWT tokens with short expiry
- HTTP-only cookies
- HTTPS only in production
- CORS configured per domain

### Data Protection

- Passwords hashed with bcrypt (12 rounds)
- Sensitive data encrypted at rest
- SQL injection prevention (Prisma ORM)
- XSS protection (React escaping + Helmet)

### Rate Limiting

- Login attempts: 5 per 15 minutes
- API requests: 100 per minute
- File uploads: 10 per hour

-----

## 10. Version Upgrade Policy

### Major Version Updates

- Quarterly review
- Test in staging first
- Backwards compatibility check
- Rollback plan required

### Minor/Patch Updates

- Monthly security patches
- Automated dependency updates via Dependabot
- Review and merge weekly

### Breaking Changes

- Document in CHANGELOG.md
- Communicate to team
- Update all related docs

```
### Sample AI Prompt for TECH_STACK Generation
```

Create a comprehensive Technology Stack document (TECH_STACK.md) for [YOUR APP DESCRIPTION].

App Context:

- Type: [Web app/Mobile/Desktop/API]
- Scale: [MVP/Small/Medium/Enterprise]
- Team Size: [Number of developers]
- Timeline: [MVP date]

Generate documentation with these sections:

1. STACK OVERVIEW

- Architecture pattern (monolithic/microservices/serverless)
- Deployment strategy
- Justification for chosen architecture

1. FRONTEND STACK
   For EACH technology, specify:

- Exact name and version (e.g., “Next.js 14.1.0” not “Next.js latest”)
- Official documentation URL
- License type
- Reason for selection
- Alternatives considered and why rejected

Required decisions:

- **Framework**: [React/Vue/Angular/Svelte/Next.js]
- **Language**: TypeScript (specify version)
- **Styling**: [Tailwind/Styled Components/CSS Modules]
- **State Management**: [Zustand/Redux/Jotai/Context]
- **Form Handling**: [React Hook Form/Formik]
- **HTTP Client**: [Axios/Fetch]
- **Routing**: [Built-in/React Router]
- **UI Components**: [Custom/shadcn/Material-UI/Chakra]

1. BACKEND STACK
   For EACH technology, specify exact versions and reasoning:

Required decisions:

- **Runtime**: [Node.js version (LTS recommended)]
- **Framework**: [Express/Fastify/NestJS/Hono]
- **Database**: [PostgreSQL/MongoDB/MySQL + version]
- **ORM**: [Prisma/TypeORM/Drizzle + version]
- **Caching**: [Redis/Memcached + version]
- **Authentication**: [JWT/Session/OAuth + libraries]
- **File Storage**: [S3/Cloudinary/Local]
- **Email**: [Resend/SendGrid/Nodemailer]

1. DATABASE SCHEMA

- Migration strategy (Prisma Migrate/TypeORM/etc.)
- Seeding approach
- Backup policy
- Connection pooling

1. DEVOPS & INFRASTRUCTURE

- **Version Control**: Git branching strategy
- **CI/CD**: Platform and workflow
- **Hosting**:
  - Frontend: [Vercel/Netlify/AWS]
  - Backend: [Railway/Fly.io/AWS/GCP]
  - Database: [Supabase/Railway/AWS RDS]
- **Monitoring**: Error tracking, analytics, logging
- **Testing**: Unit, integration, E2E frameworks

1. DEVELOPMENT TOOLS

- Linter (ESLint config)
- Formatter (Prettier config)
- Git hooks (Husky)
- IDE recommendations

1. ENVIRONMENT VARIABLES
   List all required env vars:

```
VARIABLE_NAME="description of what it is"
```

Include:

- Database URLs
- API keys
- Secrets
- Feature flags

1. PACKAGE.JSON SCRIPTS
   Define all npm scripts:

- Development
- Build
- Testing
- Database operations
- Deployment

1. DEPENDENCIES LOCK
   Create two code blocks:

```json
// Frontend dependencies with exact versions
```

```json
// Backend dependencies with exact versions
```

1. SECURITY CONSIDERATIONS
   Document:

- Authentication flow
- Password hashing (bcrypt rounds)
- Token expiry times
- CORS configuration
- Rate limiting rules
- Data encryption

1. VERSION UPGRADE POLICY
   Define:

- When to update major versions
- How to handle security patches
- Testing requirements
- Rollback procedures

CRITICAL REQUIREMENTS:

- NO “latest” or version ranges (use exact versions like “14.1.0”)
- Include documentation URLs for each library
- Specify reasons for choices
- Note alternatives considered
- Document breaking change policies
- All dependencies must have compatible versions

OUTPUT FORMAT: Markdown with code blocks for configurations, clear sections, exact versions.

```
---

## Document 4: FRONTEND_GUIDELINES.md (Frontend Design System)

### Purpose
Every visual decision locked down. Fonts, colors, spacing, components. AI builds components exactly to spec.

### Best Practices from Research
- Document components with usage examples
- Provide code snippets for each variant
- Include accessibility guidelines
- Specify when to use each component
- Document design tokens (colors, spacing, typography)
- Keep it concise and searchable
- Use visual examples where possible

### Structure Template
```

# Frontend Design System & Guidelines

## 1. Design Principles

### Core Principles

1. **Clarity**: Every element has a clear purpose
1. **Consistency**: Patterns repeat across the app
1. **Efficiency**: Minimize user effort
1. **Accessibility**: WCAG 2.1 Level AA compliance

-----

## 2. Design Tokens

### Color Palette

#### Primary Colors

```css
--color-primary-50: #eff6ff;
--color-primary-100: #dbeafe;
--color-primary-200: #bfdbfe;
--color-primary-300: #93c5fd;
--color-primary-400: #60a5fa;
--color-primary-500: #3b82f6;  /* Main brand color */
--color-primary-600: #2563eb;
--color-primary-700: #1d4ed8;
--color-primary-800: #1e40af;
--color-primary-900: #1e3a8a;
```

#### Neutral Colors

```css
--color-neutral-50: #f9fafb;
--color-neutral-100: #f3f4f6;
--color-neutral-200: #e5e7eb;
--color-neutral-300: #d1d5db;
--color-neutral-400: #9ca3af;
--color-neutral-500: #6b7280;
--color-neutral-600: #4b5563;
--color-neutral-700: #374151;
--color-neutral-800: #1f2937;
--color-neutral-900: #111827;
```

#### Semantic Colors

```css
--color-success: #10b981;  /* Green */
--color-warning: #f59e0b;  /* Amber */
--color-error: #ef4444;    /* Red */
--color-info: #3b82f6;     /* Blue */
```

#### Usage Rules

- **Primary**: CTAs, links, focus states
- **Neutral**: Text, backgrounds, borders
- **Success**: Confirmations, completed states
- **Warning**: Cautions, non-critical errors
- **Error**: Errors, destructive actions
- **Info**: Helpful tips, informational alerts

-----

### Typography

#### Font Families

```css
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'Fira Code', 'Courier New', monospace;
```

#### Font Sizes

```css
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
```

#### Font Weights

```css
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

#### Line Heights

```css
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

#### Usage Guidelines

- **Headings**: font-semibold or font-bold
- **Body text**: font-normal, –leading-normal
- **UI labels**: font-medium, –text-sm
- **Code**: font-mono, –text-sm

-----

### Spacing Scale

```css
--spacing-0: 0;
--spacing-1: 0.25rem;   /* 4px */
--spacing-2: 0.5rem;    /* 8px */
--spacing-3: 0.75rem;   /* 12px */
--spacing-4: 1rem;      /* 16px */
--spacing-5: 1.25rem;   /* 20px */
--spacing-6: 1.5rem;    /* 24px */
--spacing-8: 2rem;      /* 32px */
--spacing-10: 2.5rem;   /* 40px */
--spacing-12: 3rem;     /* 48px */
--spacing-16: 4rem;     /* 64px */
```

#### Usage Rules

- **Component padding**: spacing-4 (default)
- **Section spacing**: spacing-8 to spacing-12
- **Layout margins**: spacing-6 to spacing-16
- **Inline spacing**: spacing-2 to spacing-4

-----

### Border Radius

```css
--radius-none: 0;
--radius-sm: 0.125rem;  /* 2px */
--radius-base: 0.25rem; /* 4px */
--radius-md: 0.375rem;  /* 6px */
--radius-lg: 0.5rem;    /* 8px */
--radius-xl: 0.75rem;   /* 12px */
--radius-full: 9999px;  /* Fully rounded */
```

-----

### Shadows

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-base: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
```

-----

## 3. Layout System

### Grid System

- **Container**: max-width: 1280px, padding: 0 spacing-4
- **Columns**: 12-column grid
- **Gutters**: spacing-6 (24px)

### Responsive Breakpoints

```css
--breakpoint-sm: 640px;   /* Mobile */
--breakpoint-md: 768px;   /* Tablet */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1280px;  /* Wide Desktop */
```

### Layout Patterns

#### Centered Content

```jsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  {content}
</div>
```

#### Two-Column Layout

```jsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div>{leftColumn}</div>
  <div>{rightColumn}</div>
</div>
```

-----

## 4. Component Library

### Button

#### Variants

**Primary Button**

```jsx
<button className="
  px-4 py-2 
  bg-primary-500 hover:bg-primary-600 
  text-white font-medium
  rounded-lg
  transition-colors duration-200
  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Primary Action
</button>
```

**Secondary Button**

```jsx
<button className="
  px-4 py-2
  bg-neutral-100 hover:bg-neutral-200
  text-neutral-900 font-medium
  rounded-lg
  transition-colors duration-200
  focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2
">
  Secondary Action
</button>
```

**Danger Button**

```jsx
<button className="
  px-4 py-2
  bg-error hover:bg-red-600
  text-white font-medium
  rounded-lg
  transition-colors duration-200
">
  Delete
</button>
```

#### Sizes

- **Small**: px-3 py-1.5 text-sm
- **Medium**: px-4 py-2 text-base (default)
- **Large**: px-6 py-3 text-lg

#### Usage Rules

- Use primary for main actions (one per screen)
- Use secondary for supporting actions
- Use danger for destructive actions (with confirmation)
- Always include focus states for accessibility
- Disable while loading (show spinner)

-----

### Input Fields

**Text Input**

```jsx
<div className="space-y-1">
  <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
    Email Address
  </label>
  <input
    type="email"
    id="email"
    className="
      block w-full
      px-3 py-2
      border border-neutral-300 rounded-md
      focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
      placeholder:text-neutral-400
      disabled:bg-neutral-50 disabled:text-neutral-500
    "
    placeholder="you@example.com"
  />
  <p className="text-xs text-neutral-500">We'll never share your email.</p>
</div>
```

**Error State**

```jsx
<input
  className="
    border-error focus:ring-error
  "
  aria-invalid="true"
  aria-describedby="email-error"
/>
<p id="email-error" className="text-sm text-error mt-1">
  Please enter a valid email address
</p>
```

-----

### Cards

```jsx
<div className="
  bg-white
  border border-neutral-200
  rounded-lg
  shadow-sm
  p-6
  hover:shadow-md
  transition-shadow duration-200
">
  <h3 className="text-lg font-semibold text-neutral-900 mb-2">
    Card Title
  </h3>
  <p className="text-neutral-600">
    Card content goes here
  </p>
</div>
```

-----

### Modals

```jsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  {/* Overlay */}
  <div className="absolute inset-0 bg-black/50" onClick={onClose} />
  
  {/* Modal */}
  <div className="
    relative
    bg-white
    rounded-lg
    shadow-xl
    p-6
    max-w-md w-full
    mx-4
  ">
    <h2 className="text-xl font-semibold mb-4">Modal Title</h2>
    <p className="text-neutral-600 mb-6">Modal content</p>
    
    <div className="flex gap-3 justify-end">
      <button className="secondary-button">Cancel</button>
      <button className="primary-button">Confirm</button>
    </div>
  </div>
</div>
```

-----

## 5. Accessibility Guidelines

### WCAG 2.1 Level AA Requirements

#### Color Contrast

- **Normal text**: 4.5:1 minimum
- **Large text** (18pt+): 3:1 minimum
- **UI components**: 3:1 minimum

#### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Focus indicators must be visible (2px outline)
- Tab order must be logical

#### Screen Readers

- Use semantic HTML (button, nav, main, etc.)
- Provide alt text for images
- Use aria-labels for icon buttons
- Announce dynamic content changes

#### Forms

- Associate labels with inputs (htmlFor/id)
- Provide helpful error messages
- Mark required fields clearly
- Group related fields (fieldset/legend)

-----

## 6. Animation Guidelines

### Transitions

```css
/* Default transition */
transition: all 200ms ease-in-out;

/* Color transitions */
transition-property: background-color, border-color, color;
transition-duration: 200ms;

/* Transform transitions */
transition: transform 300ms ease-out;
```

### Usage Rules

- Keep animations under 300ms
- Use easing: ease-in-out for most animations
- Respect prefers-reduced-motion
- Animate only transform and opacity for performance

-----

## 7. Icon System

### Icon Library

- **Library**: Lucide React
- **Size**: 16px (sm), 20px (base), 24px (lg)
- **Stroke Width**: 2px (default)

### Usage

```jsx
import { Mail, Send } from 'lucide-react';

<Mail className="w-5 h-5" />
<Send className="w-5 h-5 text-primary-500" />
```

-----

## 8. State Indicators

### Loading States

```jsx
{/* Skeleton */}
<div className="animate-pulse">
  <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
</div>

{/* Spinner */}
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
```

### Empty States

```jsx
<div className="text-center py-12">
  <Icon className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
  <h3 className="text-lg font-medium text-neutral-900 mb-1">
    No items yet
  </h3>
  <p className="text-neutral-500 mb-4">
    Get started by creating your first item
  </p>
  <button className="primary-button">
    Create Item
  </button>
</div>
```

### Error States

```jsx
<div className="bg-error/10 border border-error text-error px-4 py-3 rounded-md">
  <p className="font-medium">Error</p>
  <p className="text-sm">Something went wrong. Please try again.</p>
</div>
```

-----

## 9. Responsive Design

### Mobile-First Approach

```css
/* Base styles for mobile */
.component {
  width: 100%;
}

/* Tablet and up */
@media (min-width: 768px) {
  .component {
    width: 50%;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .component {
    width: 33.333%;
  }
}
```

### Touch Targets

- Minimum size: 44x44px
- Add padding to small elements
- Ensure adequate spacing between targets

-----

## 10. Performance Guidelines

### Image Optimization

- Use Next.js Image component
- Provide width/height to prevent layout shift
- Use appropriate image formats (WebP with fallback)
- Lazy load images below fold

### Code Splitting

- Lazy load routes
- Dynamic imports for heavy components
- Defer non-critical JavaScript

-----

## 11. Browser Support

### Supported Browsers

- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)

### Progressive Enhancement

- Core functionality works without JavaScript
- Enhanced features for modern browsers
- Graceful degradation for older browsers

```
### Sample AI Prompt for FRONTEND_GUIDELINES Generation
```

Create comprehensive Frontend Design System documentation (FRONTEND_GUIDELINES.md) for [YOUR APP].

App Context:

- Style: [Modern/Minimal/Bold/Professional]
- Brand Colors: [If known]
- Target Audience: [Description]

Generate documentation with these sections:

1. DESIGN PRINCIPLES
   List 3-5 core principles that guide all design decisions.
   Example: Clarity, Consistency, Efficiency, Accessibility
1. DESIGN TOKENS

**Color Palette**:
Generate a complete color system with:

- Primary colors (50-900 scale) with hex codes
- Neutral colors (50-900 scale) with hex codes
- Semantic colors (success, warning, error, info)
- Usage rules for each color category

**Typography**:
Define:

- Font families (primary sans-serif, monospace for code)
- Font sizes (xs to 4xl with rem values)
- Font weights (light to bold with numeric values)
- Line heights (tight, normal, relaxed)
- Usage guidelines (headings, body, UI labels)

**Spacing Scale**:
Create spacing tokens from 0 to 16 (0px to 64px)
Provide usage rules for:

- Component padding
- Section spacing
- Layout margins
- Inline spacing

**Border Radius**:
Define: none, sm, base, md, lg, xl, full
With rem values

**Shadows**:
Create: sm, base, md, lg, xl shadows
With exact rgba values

1. LAYOUT SYSTEM

**Grid System**:

- Container max-width
- Column count
- Gutter size

**Responsive Breakpoints**:
Define breakpoints for:

- Mobile (sm)
- Tablet (md)
- Desktop (lg)
- Wide Desktop (xl)

**Common Layout Patterns**:
Provide code snippets for:

- Centered content
- Two-column layout
- Sidebar layout
- Grid layouts

1. COMPONENT LIBRARY

For EACH component, provide:

- All variants (primary, secondary, danger, etc.)
- Complete Tailwind CSS classes
- All sizes (small, medium, large)
- All states (default, hover, focus, disabled, loading, error)
- Usage rules (when to use each variant)
- Accessibility requirements

Required components:
**Buttons**

- Primary, Secondary, Outline, Ghost, Danger variants
- Small, Medium, Large sizes
- With icons, loading states
- Focus states for accessibility

**Input Fields**

- Text, Email, Password, Textarea variants
- Label styling
- Placeholder styling
- Error state
- Success state
- Disabled state
- Helper text styling

**Cards**

- Default style
- Hover states
- With/without image
- With/without actions

**Modals**

- Structure (overlay + content)
- Animation (fade in/slide up)
- Close behavior
- Focus trap

**Alerts/Toasts**

- Success, Warning, Error, Info variants
- With/without icons
- Dismissible option

**Navigation**

- Header/Navbar
- Sidebar
- Mobile menu
- Active states

**Forms**

- Field grouping
- Validation messages
- Submit buttons
- Multi-step patterns

**Loading States**

- Skeleton screens
- Spinners
- Progress bars

**Empty States**

- Icon + message + action
- Different contexts (no results, no data, error)

1. ACCESSIBILITY GUIDELINES

Document:

- WCAG level target (AA recommended)
- Color contrast requirements (4.5:1 for text)
- Keyboard navigation requirements
- Screen reader considerations
- Focus indicators (visible 2px outline)
- Form accessibility (labels, errors, ARIA)
- Semantic HTML requirements

1. ANIMATION GUIDELINES

Define:

- Default transition duration (200ms)
- Easing functions (ease-in-out default)
- What to animate (transform, opacity only for performance)
- Respect prefers-reduced-motion
- Loading animations
- Micro-interactions

1. ICON SYSTEM

Specify:

- Icon library (Lucide React recommended)
- Icon sizes (16px, 20px, 24px)
- Stroke width
- Usage examples
- Color application

1. STATE INDICATORS

Provide exact code for:

- Loading states (skeleton, spinner)
- Empty states (icon + message + CTA)
- Error states (alert styling)
- Success states (confirmation styling)

1. RESPONSIVE DESIGN

Document:

- Mobile-first approach
- Breakpoint usage
- Touch target minimums (44x44px)
- Responsive typography
- Responsive spacing

1. PERFORMANCE GUIDELINES

Specify:

- Image optimization (Next.js Image component)
- Code splitting strategy
- Lazy loading rules
- Critical CSS

1. BROWSER SUPPORT

List:

- Supported browsers (last 2 versions)
- Progressive enhancement approach
- Polyfill requirements

CRITICAL REQUIREMENTS:

- All CSS classes must be Tailwind-compatible
- Provide COMPLETE code snippets (not partial)
- Include EXACT hex codes for all colors
- Specify EXACT pixel/rem values
- Document ALL component states
- Include accessibility for every component
- Provide usage rules (when to use what)
- Keep colors consistent with brand (if specified)

OUTPUT FORMAT: Markdown with CSS code blocks for tokens, JSX code blocks for components, clear sections with examples.

```
---

*[Due to length constraints, I'll provide Documents 5 and 6 (BACKEND_STRUCTURE.md and IMPLEMENTATION_PLAN.md) in my next response. Would you like me to continue with those now?]*

## Document 5: BACKEND_STRUCTURE.md (Backend Architecture & Database Schema)

### Purpose
Database schema, API contracts, authentication logic. Every table, every relationship, every endpoint.

### Best Practices from Research
- Define schema before implementation
- Document relationships clearly (ERDs helpful)
- Specify exact data types and constraints
- Don't mirror database structure in API (use abstraction layer)
- Focus on business logic, not just CRUD
- Document authentication flow
- Include API versioning strategy
- Define validation rules

### Structure Template
```

# Backend Architecture & Database Structure

## 1. Architecture Overview

### System Architecture

- **Pattern**: RESTful API with server-side rendering (SSR)
- **Authentication**: JWT-based with HTTP-only cookies
- **Data Flow**: Client → API Gateway → Business Logic → Database
- **Caching Strategy**: Redis for sessions and frequent queries

-----

## 2. Database Schema

### Database: PostgreSQL 16.1

- **ORM**: Prisma 5.8.1
- **Naming Convention**: snake_case for tables/columns
- **Timestamps**: All tables have created_at, updated_at

### Entity Relationship Diagram

[ASCII or description of relationships]

-----

## 3. Tables & Relationships

### Table: `users`

**Purpose**: Stores user account information

|Column        |Type                 |Constraints                            |Description              |
|--------------|---------------------|---------------------------------------|-------------------------|
|id            |UUID                 |PRIMARY KEY, DEFAULT uuid_generate_v4()|Unique identifier        |
|email         |VARCHAR(255)         |UNIQUE, NOT NULL                       |User email (login)       |
|password_hash |VARCHAR(255)         |NOT NULL                               |Bcrypt hashed password   |
|full_name     |VARCHAR(255)         |NOT NULL                               |User’s full name         |
|avatar_url    |TEXT                 |NULL                                   |S3 URL to profile image  |
|email_verified|BOOLEAN              |DEFAULT FALSE                          |Email verification status|
|role          |ENUM(‘user’, ‘admin’)|DEFAULT ‘user’                         |User role                |
|last_login_at |TIMESTAMP            |NULL                                   |Last successful login    |
|created_at    |TIMESTAMP            |DEFAULT NOW()                          |Account creation date    |
|updated_at    |TIMESTAMP            |DEFAULT NOW()                          |Last update timestamp    |

**Indexes**:

- `idx_users_email` ON (email)
- `idx_users_created_at` ON (created_at)

**Constraints**:

- email must be valid format (checked in application)
- password_hash must be bcrypt with 12 rounds

-----

### Table: `posts`

**Purpose**: User-generated content

|Column      |Type                                  |Constraints                              |Description            |
|------------|--------------------------------------|-----------------------------------------|-----------------------|
|id          |UUID                                  |PRIMARY KEY                              |Unique identifier      |
|user_id     |UUID                                  |FOREIGN KEY → users(id) ON DELETE CASCADE|Author of post         |
|title       |VARCHAR(500)                          |NOT NULL                                 |Post title             |
|content     |TEXT                                  |NOT NULL                                 |Post body (markdown)   |
|slug        |VARCHAR(600)                          |UNIQUE, NOT NULL                         |URL-friendly identifier|
|status      |ENUM(‘draft’, ‘published’, ‘archived’)|DEFAULT ‘draft’                          |Publication status     |
|published_at|TIMESTAMP                             |NULL                                     |First publication date |
|view_count  |INTEGER                               |DEFAULT 0                                |Number of views        |
|created_at  |TIMESTAMP                             |DEFAULT NOW()                            |Creation timestamp     |
|updated_at  |TIMESTAMP                             |DEFAULT NOW()                            |Last edit timestamp    |

**Indexes**:

- `idx_posts_user_id` ON (user_id)
- `idx_posts_slug` ON (slug)
- `idx_posts_status` ON (status)
- `idx_posts_published_at` ON (published_at DESC)

**Relationships**:

- `user_id` → `users.id` (many-to-one)
- One post has many comments
- One post has many likes

-----

### Table: `comments`

**Purpose**: User comments on posts

|Column           |Type     |Constraints                                       |Description         |
|-----------------|---------|--------------------------------------------------|--------------------|
|id               |UUID     |PRIMARY KEY                                       |Unique identifier   |
|post_id          |UUID     |FOREIGN KEY → posts(id) ON DELETE CASCADE         |Parent post         |
|user_id          |UUID     |FOREIGN KEY → users(id) ON DELETE CASCADE         |Comment author      |
|content          |TEXT     |NOT NULL                                          |Comment text        |
|parent_comment_id|UUID     |FOREIGN KEY → comments(id) ON DELETE CASCADE, NULL|For threaded replies|
|is_deleted       |BOOLEAN  |DEFAULT FALSE                                     |Soft delete flag    |
|created_at       |TIMESTAMP|DEFAULT NOW()                                     |Creation timestamp  |
|updated_at       |TIMESTAMP|DEFAULT NOW()                                     |Last edit timestamp |

**Indexes**:

- `idx_comments_post_id` ON (post_id)
- `idx_comments_user_id` ON (user_id)
- `idx_comments_parent_id` ON (parent_comment_id)

**Relationships**:

- `post_id` → `posts.id` (many-to-one)
- `user_id` → `users.id` (many-to-one)
- `parent_comment_id` → `comments.id` (self-referential, for nested comments)

-----

### Table: `likes`

**Purpose**: Track user likes on posts

|Column    |Type     |Constraints                              |Description       |
|----------|---------|-----------------------------------------|------------------|
|id        |UUID     |PRIMARY KEY                              |Unique identifier |
|user_id   |UUID     |FOREIGN KEY → users(id) ON DELETE CASCADE|User who liked    |
|post_id   |UUID     |FOREIGN KEY → posts(id) ON DELETE CASCADE|Liked post        |
|created_at|TIMESTAMP|DEFAULT NOW()                            |When like occurred|

**Indexes**:

- `idx_likes_user_post` ON (user_id, post_id) UNIQUE
- `idx_likes_post_id` ON (post_id)

**Constraints**:

- Unique combination of user_id + post_id (one like per user per post)

**Relationships**:

- `user_id` → `users.id`
- `post_id` → `posts.id`

-----

### Table: `sessions`

**Purpose**: Track active user sessions (for JWT refresh tokens)

|Column       |Type        |Constraints                              |Description         |
|-------------|------------|-----------------------------------------|--------------------|
|id           |UUID        |PRIMARY KEY                              |Unique identifier   |
|user_id      |UUID        |FOREIGN KEY → users(id) ON DELETE CASCADE|Session owner       |
|refresh_token|VARCHAR(255)|UNIQUE, NOT NULL                         |Hashed refresh token|
|user_agent   |TEXT        |NULL                                     |Browser/device info |
|ip_address   |VARCHAR(45) |NULL                                     |IP address          |
|expires_at   |TIMESTAMP   |NOT NULL                                 |Token expiration    |
|created_at   |TIMESTAMP   |DEFAULT NOW()                            |Session start       |

**Indexes**:

- `idx_sessions_user_id` ON (user_id)
- `idx_sessions_refresh_token` ON (refresh_token)
- `idx_sessions_expires_at` ON (expires_at)

**Cleanup**:

- Cron job runs daily to delete expired sessions

-----

## 4. API Endpoints

### Authentication Endpoints

#### POST /api/auth/register

**Purpose**: Create new user account

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "full_name": "John Doe"
}
```

**Validation**:

- email: valid format, unique in database
- password: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 symbol
- full_name: 2-255 characters

**Response (201)**:

```json
{
  "message": "Account created. Please verify your email.",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe"
  }
}
```

**Errors**:

- 400: Validation failed
- 409: Email already exists

**Side Effects**:

- Creates user in database
- Sends verification email
- Logs registration event

-----

#### POST /api/auth/login

**Purpose**: Authenticate user and return JWT tokens

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200)**:

```json
{
  "access_token": "eyJhbGciOiJIUzI1...",
  "refresh_token": "eyJhbGciOiJIUzI1...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "avatar_url": "https://...",
    "role": "user"
  }
}
```

**Cookies Set**:

- `access_token`: HTTP-only, Secure, SameSite=Strict, Max-Age=15min
- `refresh_token`: HTTP-only, Secure, SameSite=Strict, Max-Age=7days

**Errors**:

- 401: Invalid credentials
- 403: Email not verified
- 429: Too many login attempts (rate limited)

**Side Effects**:

- Updates last_login_at
- Creates session record
- Logs successful login

-----

#### POST /api/auth/refresh

**Purpose**: Get new access token using refresh token

**Cookies Required**: `refresh_token`

**Response (200)**:

```json
{
  "access_token": "eyJhbGciOiJIUzI1..."
}
```

**Errors**:

- 401: Invalid or expired refresh token

-----

### Post Endpoints

#### GET /api/posts

**Purpose**: List published posts with pagination

**Query Parameters**:

- `page`: Page number (default: 1)
- `limit`: Items per page (max: 50, default: 20)
- `sort`: `newest` | `oldest` | `popular` (default: newest)
- `author`: Filter by user_id

**Response (200)**:

```json
{
  "posts": [
    {
      "id": "uuid",
      "title": "Post Title",
      "slug": "post-title",
      "content": "Post content...",
      "author": {
        "id": "uuid",
        "full_name": "John Doe",
        "avatar_url": "https://..."
      },
      "published_at": "2024-01-15T10:00:00Z",
      "view_count": 123,
      "like_count": 45,
      "comment_count": 12
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

**Caching**:

- Cache key: `posts:list:page:{page}:sort:{sort}`
- TTL: 5 minutes
- Invalidate on: New post published, post updated/deleted

-----

#### POST /api/posts

**Purpose**: Create new post (requires authentication)

**Headers Required**:

- `Authorization: Bearer {access_token}`

**Request Body**:

```json
{
  "title": "Post Title",
  "content": "Post content in markdown...",
  "status": "draft" | "published"
}
```

**Validation**:

- title: 5-500 characters
- content: 1-50,000 characters
- status: enum value
- Slug auto-generated from title

**Response (201)**:

```json
{
  "post": {
    "id": "uuid",
    "title": "Post Title",
    "slug": "post-title",
    "status": "draft",
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

**Errors**:

- 401: Not authenticated
- 400: Validation failed
- 409: Slug already exists

-----

## 5. Authentication & Authorization

### JWT Token Structure

**Access Token** (15 minute expiry):

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "user",
  "iat": 1234567890,
  "exp": 1234568790
}
```

**Refresh Token** (7 day expiry):

```json
{
  "sub": "user_id",
  "session_id": "session_uuid",
  "iat": 1234567890,
  "exp": 1235172690
}
```

### Authorization Levels

#### Public Routes (No auth required)

- GET /api/posts
- GET /api/posts/:slug
- POST /api/auth/register
- POST /api/auth/login

#### Authenticated Routes (Valid access token)

- POST /api/posts
- PUT /api/posts/:id
- DELETE /api/posts/:id
- POST /api/comments
- POST /api/likes

#### Admin Routes (role: admin)

- DELETE /api/users/:id
- PUT /api/posts/:id (any post)

### Password Security

- Hashing: bcrypt with 12 rounds
- Never stored in plain text
- Never returned in API responses
- Reset via email verification only

-----

## 6. Data Validation Rules

### Email Validation

```javascript
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Additional checks:
// - Max length: 255 chars
// - No disposable email domains
// - Must be unique in database
```

### Password Requirements

```javascript
// Minimum requirements:
// - Length: 8-128 characters
// - At least 1 uppercase letter
// - At least 1 lowercase letter
// - At least 1 number
// - At least 1 special character (!@#$%^&*)
// - No common passwords (check against list)
```

### Content Sanitization

- Strip HTML tags from user input
- Allow markdown in post content
- Sanitize before storage and before display
- Max lengths enforced at DB level

-----

## 7. Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email already exists"
      }
    ]
  }
}
```

### Error Codes

- `VALIDATION_ERROR`: 400
- `UNAUTHORIZED`: 401
- `FORBIDDEN`: 403
- `NOT_FOUND`: 404
- `CONFLICT`: 409
- `RATE_LIMITED`: 429
- `SERVER_ERROR`: 500

-----

## 8. Caching Strategy

### Cache Layers

1. **Redis** (most frequent)
- User sessions
- API rate limits
- Frequently accessed posts
1. **Database Query Cache**
- Prisma query caching
- TTL: 5 minutes

### Cache Keys

- Sessions: `session:{refresh_token}`
- Posts list: `posts:list:page:{page}:sort:{sort}`
- Post detail: `post:slug:{slug}`
- User profile: `user:id:{user_id}`

### Cache Invalidation

- On UPDATE: Invalidate related cache keys
- On DELETE: Invalidate + remove from cache
- On CREATE: Invalidate list caches

-----

## 9. Rate Limiting

### Limits by Endpoint

- Login: 5 requests per 15 minutes per IP
- Register: 3 requests per hour per IP
- API (authenticated): 100 requests per minute
- API (public): 50 requests per minute

### Implementation

- Store in Redis with sliding window
- Return 429 with Retry-After header
- Block IP after 10 consecutive 429s

-----

## 10. Database Migrations

### Migration Strategy

- Use Prisma Migrate
- Never edit migrations after deployed
- Always create new migration for changes
- Test on staging before production

### Migration Process

```bash
# 1. Create migration
prisma migrate dev --name add_posts_table

# 2. Test locally

# 3. Deploy to staging
prisma migrate deploy

# 4. Test on staging

# 5. Deploy to production
prisma migrate deploy
```

-----

## 11. Backup & Recovery

### Backup Strategy

- **Frequency**: Daily automated backups at 2 AM UTC
- **Retention**: 30 days
- **Location**: AWS S3 with encryption
- **Type**: Full database dump + WAL archiving

### Recovery Procedure

1. Identify backup timestamp
1. Restore from S3
1. Apply WAL logs if needed
1. Verify data integrity
1. Update application config
1. Test critical paths

-----

## 12. API Versioning

### Current Version: v1

### Versioning Strategy

- URL-based: `/api/v1/posts`
- No version in URL defaults to v1
- Maintain backwards compatibility for 6 months
- Deprecation warnings in headers

### Breaking Changes

- Announce 3 months in advance
- Provide migration guide
- Support old version during transition
- Monitor usage before deprecation

```
### Sample AI Prompt for BACKEND_STRUCTURE Generation
```

Create comprehensive Backend Structure documentation (BACKEND_STRUCTURE.md) for [YOUR APP].

Context:
[Brief app description]
[Main features that need database support]

Generate documentation with these sections:

1. ARCHITECTURE OVERVIEW

- System architecture pattern (RESTful API, GraphQL, etc.)
- Authentication strategy
- Data flow diagram (text description)
- Caching strategy

1. DATABASE SCHEMA

For EACH table, provide complete specification:

**Table Name**: [snake_case]
**Purpose**: [What this table stores]

**Columns**:
Create a markdown table with:

|Column|Type|Constraints|Description|
|------|----|-----------|-----------|

Include:

- id (UUID primary key for all tables)
- Foreign keys with ON DELETE actions
- NOT NULL / UNIQUE constraints
- DEFAULT values
- Exact data types (VARCHAR with length, INTEGER, TIMESTAMP, etc.)
- created_at, updated_at timestamps on all tables

**Indexes**:
List all indexes:

- Primary key
- Foreign keys
- Frequently queried columns
- Composite indexes for common queries

**Relationships**:

- Foreign key references
- One-to-many / Many-to-many relationships
- Self-referential relationships (if any)

Required Tables (customize based on app):

- users (authentication)
- [main entity tables based on features]
- [junction tables for many-to-many relationships]
- sessions (for refresh tokens)

1. API ENDPOINTS

For EACH endpoint, document:

**HTTP Method + Path**: POST /api/resource
**Purpose**: [What this endpoint does]

**Authentication**: Required/Optional/Public

**Request Headers** (if needed):

```
Authorization: Bearer {token}
```

**Request Body** (with example JSON):

```json
{
  "field": "value"
}
```

**Validation Rules**:

- Field: [requirements]
- Field: [requirements]

**Response (Status Code)**:

```json
{
  "success": true,
  "data": {}
}
```

**Errors**:

- 400: [When this happens]
- 401: [When this happens]
- 404: [When this happens]

**Side Effects**:

- [Database changes]
- [External API calls]
- [Email sends]
- [Cache invalidations]

**Caching** (if applicable):

- Cache key format
- TTL (Time To Live)
- Invalidation triggers

Required Endpoint Categories:

- **Authentication**: register, login, logout, refresh token
- **Main Resources**: CRUD operations
- **Relationships**: Create/delete relationships

1. AUTHENTICATION & AUTHORIZATION

**JWT Token Structure**:
Document access and refresh token payloads

**Authorization Levels**:

- Public routes (no auth)
- Authenticated routes (valid token)
- Admin routes (role-based)

**Password Security**:

- Hashing algorithm (bcrypt recommended)
- Salt rounds (12 recommended)
- Password requirements
- Reset flow

1. DATA VALIDATION RULES

For critical fields, specify:

- Email validation (regex)
- Password requirements (complexity)
- Content sanitization (XSS prevention)
- Input length limits
- File upload restrictions

1. ERROR HANDLING

**Error Response Format**:
Standardized JSON structure for all errors

**Error Codes**:
Map error codes to HTTP status codes:

- VALIDATION_ERROR: 400
- UNAUTHORIZED: 401
- FORBIDDEN: 403
- NOT_FOUND: 404
- etc.

1. CACHING STRATEGY

**Cache Layers**:

- What gets cached (sessions, data, etc.)
- Cache provider (Redis recommended)
- TTL values

**Cache Keys**:
Format for different data types

**Cache Invalidation**:
When to invalidate (CRUD operations)

1. RATE LIMITING

**Limits by Endpoint**:

- Login: [limit] per [timeframe]
- Registration: [limit] per [timeframe]
- API calls: [limit] per [timeframe]

**Implementation**:

- Storage (Redis)
- Response format (429 status)

1. DATABASE MIGRATIONS

**Migration Strategy**:

- Tool (Prisma Migrate / TypeORM / etc.)
- Process (dev → staging → production)
- Rollback plan

1. BACKUP & RECOVERY

**Backup Strategy**:

- Frequency (daily recommended)
- Retention period (30 days recommended)
- Location (S3 or similar)
- Type (full dumps + incremental)

**Recovery Procedure**:
Step-by-step restore process

1. API VERSIONING

**Current Version**: v1

**Versioning Strategy**:

- URL structure (/api/v1/)
- Backwards compatibility policy
- Deprecation process

CRITICAL REQUIREMENTS:

- All tables must have id, created_at, updated_at
- Specify EXACT data types with lengths
- Define ALL constraints and indexes
- Document EVERY endpoint completely
- Include validation rules
- Specify error responses
- Define cache invalidation logic
- Use consistent naming (snake_case for DB, camelCase for API)

OUTPUT FORMAT: Markdown with tables for schemas, JSON code blocks for API examples, clear sections.

```
---

## Document 6: IMPLEMENTATION_PLAN.md (Step-by-Step Build Sequence)

### Purpose
The exact order to build things. Step 1.1, 1.2, 2.1, 2.2. No hallucinations on what to build first.

### Best Practices from Research
- Break into small, testable increments
- Define clear milestones
- Include testing at each step
- Specify dependencies between steps
- Focus on iterative delivery
- Plan for feedback loops
- Document success criteria per step

### Structure Template
```

# Implementation Plan & Build Sequence

## Overview

**Project**: [App Name]
**MVP Target Date**: [Date]
**Approach**: Iterative development with continuous testing

### Build Philosophy

- Code follows documentation (not the reverse)
- Test after every step
- Deploy to staging after each milestone
- Gather feedback before continuing

-----

## Phase 1: Project Setup & Foundation

### Step 1.1: Initialize Project Structure

**Duration**: 1 hour
**Goal**: Create project with all configuration files

**Tasks**:

1. Initialize Git repository
   
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
1. Initialize Next.js project
   
   ```bash
   npx create-next-app@14.1.0 my-app --typescript --tailwind --app
   ```
1. Install core dependencies (from TECH_STACK.md)
   
   ```bash
   pnpm add [list exact versions from TECH_STACK.md]
   ```
1. Setup linting & formatting
- Copy ESLint config
- Copy Prettier config
- Setup Husky pre-commit hooks

**Success Criteria**:

- [ ] Project runs locally (`pnpm dev`)
- [ ] No linting errors
- [ ] Git hooks work (pre-commit formats code)

**Reference Docs**: TECH_STACK.md sections 2, 5

-----

### Step 1.2: Environment Setup

**Duration**: 30 minutes
**Goal**: Configure environment variables and secrets

**Tasks**:

1. Create `.env.local` file
1. Add all required variables from TECH_STACK.md section 6
1. Create `.env.example` template
1. Add `.env.local` to `.gitignore`

**Success Criteria**:

- [ ] All required env vars present
- [ ] App reads env vars correctly
- [ ] No secrets committed to Git

**Reference Docs**: TECH_STACK.md section 6

-----

### Step 1.3: Setup Database

**Duration**: 1 hour
**Goal**: Database running with schema applied

**Tasks**:

1. Install PostgreSQL locally OR setup cloud instance
1. Create database
1. Configure DATABASE_URL in .env.local
1. Setup Prisma:
   
   ```bash
   npx prisma init
   ```
1. Create schema.prisma from BACKEND_STRUCTURE.md
1. Run first migration:
   
   ```bash
   npx prisma migrate dev --name init
   ```
1. Verify with Prisma Studio:
   
   ```bash
   npx prisma studio
   ```

**Success Criteria**:

- [ ] Database connection works
- [ ] All tables created
- [ ] Can view tables in Prisma Studio
- [ ] Migrations folder has init migration

**Reference Docs**: BACKEND_STRUCTURE.md sections 2, 3, 9

-----

## Phase 2: Design System Implementation

### Step 2.1: Setup Design Tokens

**Duration**: 2 hours
**Goal**: Tailwind configured with custom design tokens

**Tasks**:

1. Update `tailwind.config.js` with colors from FRONTEND_GUIDELINES.md
1. Add custom spacing scale
1. Add custom typography
1. Add custom border radius values
1. Test in a sample component

**Code**:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          // ... all values from FRONTEND_GUIDELINES.md
        }
      }
    }
  }
}
```

**Success Criteria**:

- [ ] All design tokens in Tailwind config
- [ ] Can use custom classes in components
- [ ] No console errors

**Reference Docs**: FRONTEND_GUIDELINES.md section 2

-----

### Step 2.2: Build Core Components

**Duration**: 4 hours
**Goal**: Reusable component library

**Tasks**:

1. Create `/components/ui` folder
1. Implement Button component (all variants from FRONTEND_GUIDELINES.md)
1. Implement Input component (all states)
1. Implement Card component
1. Implement Modal component
1. Test each component in isolation

**For EACH component**:

1. Create component file
1. Copy exact Tailwind classes from FRONTEND_GUIDELINES.md
1. Add TypeScript types
1. Create usage example
1. Test all variants/states

**Success Criteria**:

- [ ] All component variants work
- [ ] TypeScript has no errors
- [ ] Components match design system exactly
- [ ] Accessible (keyboard nav, ARIA labels)

**Reference Docs**: FRONTEND_GUIDELINES.md section 4

-----

## Phase 3: Authentication System

### Step 3.1: Backend - Auth Endpoints

**Duration**: 3 hours
**Goal**: Working registration and login

**Tasks**:

1. Create `/api/auth/register/route.ts`
1. Implement registration logic per BACKEND_STRUCTURE.md
1. Create `/api/auth/login/route.ts`
1. Implement login logic
1. Setup JWT token generation
1. Setup bcrypt password hashing
1. Test with Postman/Thunder Client

**Implementation per BACKEND_STRUCTURE.md**:

- Email validation
- Password hashing (12 rounds)
- JWT token creation (15min access, 7day refresh)
- Error handling (400, 409, 401)

**Success Criteria**:

- [ ] Can register new user
- [ ] Password is hashed (never plain text)
- [ ] Can login with correct credentials
- [ ] Returns JWT tokens
- [ ] Rejects invalid inputs
- [ ] Rejects duplicate emails

**Reference Docs**: BACKEND_STRUCTURE.md section 4 (Auth endpoints)

-----

### Step 3.2: Frontend - Auth Pages

**Duration**: 3 hours
**Goal**: Registration and login UI

**Tasks**:

1. Create `/app/register/page.tsx`
1. Build registration form per APP_FLOW.md
1. Create `/app/login/page.tsx`
1. Build login form
1. Implement form validation (client-side)
1. Connect to API endpoints
1. Handle success/error states

**Form Requirements** (from APP_FLOW.md):

- Email field with validation
- Password field with strength indicator
- Error messages inline
- Loading states during submit
- Success redirect to dashboard

**Success Criteria**:

- [ ] Registration flow works end-to-end
- [ ] Login flow works end-to-end
- [ ] Validation shows proper errors
- [ ] Loading states display correctly
- [ ] Tokens stored in HTTP-only cookies

**Reference Docs**:

- APP_FLOW.md (Registration & Login flows)
- FRONTEND_GUIDELINES.md (Form components)

-----

## Phase 4: Core Features

### Step 4.1: [Main Feature - e.g., Post Creation]

**Duration**: 4 hours
**Goal**: Users can create posts

**Tasks**:

1. Create database table (already done in Step 1.3)
1. Create `/api/posts/route.ts` (POST endpoint)
1. Implement create logic per BACKEND_STRUCTURE.md
1. Create `/app/posts/new/page.tsx`
1. Build post creation form
1. Connect form to API
1. Test creation flow

**API Implementation**:

- Check authentication
- Validate input
- Generate slug from title
- Save to database
- Return created post

**UI Implementation**:

- Title input
- Content textarea (markdown editor)
- Status selector (draft/published)
- Submit button with loading state
- Error/success handling

**Success Criteria**:

- [ ] Authenticated users can create posts
- [ ] Posts saved to database
- [ ] Slug auto-generated correctly
- [ ] Validation works (client + server)
- [ ] Success redirects to post view

**Reference Docs**:

- PRD.md (Post feature requirements)
- APP_FLOW.md (Post creation flow)
- BACKEND_STRUCTURE.md (Post endpoints)

-----

### Step 4.2: [Main Feature - e.g., Post Listing]

**Duration**: 3 hours
**Goal**: Display list of published posts

**Tasks**:

1. Create `/api/posts/route.ts` (GET endpoint)
1. Implement pagination logic
1. Add caching layer (Redis)
1. Create `/app/posts/page.tsx`
1. Fetch and display posts
1. Implement pagination UI
1. Test with multiple posts

**Success Criteria**:

- [ ] Posts display in grid/list
- [ ] Pagination works (20 per page)
- [ ] Cache reduces DB queries
- [ ] Loading states show
- [ ] Empty state displays when no posts

**Reference Docs**:

- APP_FLOW.md (Post listing screen)
- BACKEND_STRUCTURE.md (GET /api/posts)

-----

## Phase 5: Testing & Refinement

### Step 5.1: Unit Tests

**Duration**: 3 hours
**Goal**: Critical paths covered with tests

**Tasks**:

1. Setup Vitest (if not already)
1. Write tests for auth functions
1. Write tests for validation logic
1. Write tests for data transformations
1. Run tests: `pnpm test`

**Test Coverage Targets**:

- Authentication: 90%
- Validation: 95%
- Core features: 80%

**Success Criteria**:

- [ ] All tests pass
- [ ] Coverage meets targets
- [ ] No console errors during tests

-----

### Step 5.2: Integration Tests

**Duration**: 4 hours
**Goal**: End-to-end flows work

**Tasks**:

1. Setup Playwright
1. Write test for registration flow
1. Write test for login flow
1. Write test for post creation flow
1. Run tests: `pnpm test:e2e`

**Success Criteria**:

- [ ] Registration flow passes
- [ ] Login flow passes
- [ ] Create post flow passes
- [ ] Tests run in CI/CD

-----

## Phase 6: Deployment

### Step 6.1: Deploy to Staging

**Duration**: 2 hours
**Goal**: App running on staging environment

**Tasks**:

1. Create Vercel project (frontend)
1. Create Railway project (backend + database)
1. Configure environment variables
1. Deploy both apps
1. Test on staging URLs
1. Fix any deployment issues

**Success Criteria**:

- [ ] Frontend deployed and accessible
- [ ] Backend deployed and accessible
- [ ] Database migrations ran
- [ ] All features work on staging
- [ ] No console errors

-----

### Step 6.2: Production Deployment

**Duration**: 2 hours
**Goal**: App live for users

**Tasks**:

1. Final testing on staging
1. Deploy to production
1. Run smoke tests
1. Monitor error logs
1. Communicate launch

**Success Criteria**:

- [ ] App accessible on production domain
- [ ] All features functional
- [ ] No critical errors in logs
- [ ] Performance metrics acceptable

-----

## Milestones & Timeline

### Milestone 1: Foundation Complete

**Target**: End of Week 1
**Deliverables**:

- [ ] Project setup
- [ ] Database configured
- [ ] Design system implemented

### Milestone 2: Auth System Complete

**Target**: End of Week 2
**Deliverables**:

- [ ] Registration works
- [ ] Login works
- [ ] Session management

### Milestone 3: Core Features Complete

**Target**: End of Week 3
**Deliverables**:

- [ ] Main feature implemented
- [ ] CRUD operations work
- [ ] UI polished

### Milestone 4: MVP Launch

**Target**: End of Week 4
**Deliverables**:

- [ ] Tests passing
- [ ] Deployed to production
- [ ] Documentation updated

-----

## Risk Mitigation

### Technical Risks

|Risk                   |Impact  |Mitigation                                         |
|-----------------------|--------|---------------------------------------------------|
|Database schema changes|High    |Follow migration process strictly                  |
|API breaking changes   |High    |Version endpoints, maintain backwards compatibility|
|Authentication bugs    |Critical|Extensive testing, use proven libraries            |
|Performance issues     |Medium  |Implement caching early, monitor metrics           |

### Timeline Risks

|Risk                |Impact|Mitigation                           |
|--------------------|------|-------------------------------------|
|Scope creep         |High  |Stick to PRD.md, defer P1/P2 features|
|Underestimated tasks|Medium|Build buffer time, track actuals     |
|Dependency delays   |Medium|Identify early, have fallback options|

-----

## Success Criteria (Overall)

### MVP is successful when:

1. ✅ All P0 features from PRD.md implemented
1. ✅ All user flows from APP_FLOW.md working
1. ✅ Design matches FRONTEND_GUIDELINES.md
1. ✅ API matches BACKEND_STRUCTURE.md
1. ✅ 80% test coverage achieved
1. ✅ Zero critical bugs in production
1. ✅ Performance: < 2s page load
1. ✅ Accessibility: WCAG 2.1 AA compliant

-----

## Post-MVP Roadmap

### After MVP launch, prioritize:

1. P1 features from PRD.md
1. User feedback implementation
1. Performance optimization
1. Analytics integration
1. P2 features (nice-to-haves)

```
### Sample AI Prompt for IMPLEMENTATION_PLAN Generation
```

Create a comprehensive Implementation Plan (IMPLEMENTATION_PLAN.md) for [YOUR APP].

Context:

- MVP Timeline: [Weeks available]
- Team Size: [Number of developers]
- Tech Stack: [From TECH_STACK.md]

Generate documentation with these sections:

1. OVERVIEW

- Project name
- MVP target date
- Build philosophy (documentation-first approach)

1. PHASE 1: PROJECT SETUP & FOUNDATION

Break down into steps:

**Step 1.1: Initialize Project Structure**

- Duration estimate
- Goal statement
- Tasks (numbered list with exact commands)
- Success criteria (checklist)
- Reference to relevant docs

**Step 1.2: Environment Setup**
[Same format]

**Step 1.3: Database Setup**
[Same format]

For EACH step include:

- Exact bash commands where applicable
- Code snippets for configurations
- Links to documentation sections
- Testable success criteria

1. PHASE 2: DESIGN SYSTEM IMPLEMENTATION

**Step 2.1: Setup Design Tokens**

- Configure Tailwind with values from FRONTEND_GUIDELINES.md
- Exact code for tailwind.config.js

**Step 2.2: Build Core Components**

- List all components from FRONTEND_GUIDELINES.md
- Implementation order
- Testing approach

1. PHASE 3: AUTHENTICATION SYSTEM

**Step 3.1: Backend - Auth Endpoints**

- Implement registration endpoint
- Implement login endpoint
- JWT setup
- Password hashing
- Test with API client

**Step 3.2: Frontend - Auth Pages**

- Registration form
- Login form
- Validation
- Error handling
- Success flows

Reference exact flows from APP_FLOW.md

1. PHASE 4: CORE FEATURES

For EACH P0 feature from PRD.md:

**Step 4.X: [Feature Name]**

- Backend implementation
- Frontend implementation
- Testing
- Success criteria

Break features into:

- Database work (if new tables)
- API endpoints
- UI components
- Integration
- Testing

1. PHASE 5: TESTING & REFINEMENT

**Step 5.1: Unit Tests**

- What to test
- Coverage targets
- Tools (Vitest, Jest)

**Step 5.2: Integration Tests**

- E2E flows to test
- Tools (Playwright, Cypress)

1. PHASE 6: DEPLOYMENT

**Step 6.1: Deploy to Staging**

- Platform setup
- Configuration
- Deployment process
- Smoke testing

**Step 6.2: Production Deployment**

- Final checks
- Deployment process
- Monitoring setup
- Rollback plan

1. MILESTONES & TIMELINE

Create milestones:
**Milestone 1: [Name]**

- Target date
- Deliverables (checklist)

Repeat for:

- Foundation Complete
- Auth Complete
- Core Features Complete
- MVP Launch

1. RISK MITIGATION

Create tables:
**Technical Risks**

|Risk|Impact|Mitigation|
|----|------|----------|

**Timeline Risks**

|Risk|Impact|Mitigation|
|----|------|----------|

Include risks like:

- Schema changes
- Scope creep
- API breaking changes
- Performance issues
- Dependency delays

1. SUCCESS CRITERIA

Define when MVP is successful:

- All P0 features implemented
- All flows working
- Design matches guidelines
- Test coverage achieved
- Performance targets met
- Accessibility compliance

1. POST-MVP ROADMAP

What comes after MVP:

- P1 features
- User feedback loop
- Performance optimization
- Analytics
- P2 features

CRITICAL REQUIREMENTS:

- Steps must reference documentation sections
- Include exact commands and code snippets
- Each step must have testable success criteria
- Order must account for dependencies
- Duration estimates must be realistic
- Break complex steps into sub-steps
- Every step outputs something testable
- Reference PRD, APP_FLOW, TECH_STACK, FRONTEND_GUIDELINES, BACKEND_STRUCTURE

OUTPUT FORMAT: Markdown with clear phases, numbered steps, code blocks, checklists, tables.

```
---

## Conclusion

These six documents form your complete knowledge base. When AI reads them:

1. **PRD.md** tells it WHAT to build
2. **APP_FLOW.md** tells it HOW users navigate
3. **TECH_STACK.md** tells it WHICH tools to use
4. **FRONTEND_GUIDELINES.md** tells it HOW it should look
5. **BACKEND_STRUCTURE.md** tells it HOW data works
6. **IMPLEMENTATION_PLAN.md** tells it WHAT ORDER to build

Together, they eliminate hallucinations and ensure AI builds exactly what you specified.

---

## Using These Documents

### Before Every AI Coding Session:
1. Give AI relevant docs as context
2. Reference specific sections
3. Ask AI to confirm understanding
4. Build iteratively, testing each step

### Example Prompt:
```

I have complete documentation for my project. Please review:

1. PRD.md - focus on [Feature X]
1. APP_FLOW.md - review the [User Flow Y]
1. TECH_STACK.md - we’re using [Tech Z version]
1. FRONTEND_GUIDELINES.md - follow [Component Guidelines]
1. BACKEND_STRUCTURE.md - implement [Endpoint A]

Based on these docs, implement [Feature X] following IMPLEMENTATION_PLAN.md Step 4.2.

Do not deviate from the specifications. Ask clarifying questions if anything is ambiguous.

```
This is documentation-first development. Your project stays on track because AI has no room to guess.
```