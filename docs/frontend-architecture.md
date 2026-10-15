# Frontend Architecture

## Frontend Framework and Verified Versions

The NeuroPattern frontend is built with modern web technologies:

- **Language:** TypeScript 5.7.3
- **Framework:** React 19.2.4
- **Build Tool:** Vite 6.0.0
- **Routing:** React Router DOM 7.13.0 (HashRouter)
- **State Management:** React Context API
- **Visualization:** Recharts 3.7.0
- **Package Manager:** pnpm 11.5.0

## Directory and Module Organization

```
src/
├── pages/              # Route components (lazy-loaded)
│   ├── Analysis.tsx
│   ├── Auth.tsx
│   ├── CheckIn.tsx
│   ├── ForgotPassword.tsx
│   ├── Habits.tsx
│   ├── Home.tsx
│   ├── Insights.tsx
│   ├── Onboarding.tsx
│   ├── Profile.tsx
│   └── ResetPassword.tsx
├── components/         # Reusable UI components
│   ├── Gauge.tsx
│   ├── Navigation.tsx
│   ├── coach/         # Coach-specific components
│   └── layout/        # Layout components
├── context/           # React Context providers
│   └── AppContext.tsx
├── services/          # API client services
│   ├── auth.service.ts
│   ├── coach.service.ts
│   ├── habits.service.ts
│   ├── http.service.ts
│   ├── logs.service.ts
│   └── user.service.ts
├── core/              # AI and audio processing utilities
│   ├── AuraCoach.ts
│   ├── LanguageDetector.ts
│   ├── ResponseGenerator.ts
│   ├── TTSEngine.ts
│   ├── VoiceProcessor.ts
│   └── index.ts
├── utils/             # Helper functions
│   ├── AudioNormalizer.ts
│   ├── TranscriptCleaner.ts
│   └── UnicodeHelper.ts
├── types/             # TypeScript type definitions
│   ├── CoachTypes.ts
│   ├── VoiceTypes.ts
│   └── types.ts
├── constants/         # Configuration constants
│   ├── api.ts
│   └── routes.ts
├── hooks/             # Custom React hooks
├── styles/            # Global styles
├── App.tsx            # Root component
├── index.tsx          # Entry point
├── index.html         # HTML template
├── tsconfig.json      # TypeScript configuration
└── vite.config.ts     # Vite build configuration
```

## Application Entry Point and Initialization

### Entry Point (`src/index.tsx`)

The application initializes by:

1. Rendering the root `App` component
2. Mounting to the DOM element with id `root`

### Root Component (`src/App.tsx`)

The `App` component:

1. Wraps the application in `AppProvider` for global state
2. Sets up `HashRouter` for client-side routing
3. Lazy-loads all page components for code splitting
4. Provides a loading fallback during route transitions
5. Defines all application routes

### Initialization Flow

```
index.tsx → App.tsx → AppProvider → HashRouter → Lazy-loaded Pages
```

## Routing Strategy

### HashRouter

The application uses `HashRouter` from React Router DOM for client-side routing. This choice ensures compatibility with:

- Docker deployments where server-side routing may not be configured
- Static file serving without custom server configuration
- Development and production environments without URL rewriting

### Route Definitions

Routes are defined in `src/constants/routes.ts` and registered in `src/App.tsx`:

| Route Path         | Component      | Purpose                 |
| ------------------ | -------------- | ----------------------- |
| `/onboarding`      | Onboarding     | First-time user setup   |
| `/auth`            | Auth           | Login and registration  |
| `/forgot-password` | ForgotPassword | Password reset request  |
| `/reset-password`  | ResetPassword  | Password reset form     |
| `/`                | Home           | Dashboard and overview  |
| `/analysis`        | Analysis       | Wellness analysis page  |
| `/coach`           | CheckIn        | AI coach check-in       |
| `/profile`         | Profile        | User profile management |
| `/insights`        | Insights       | Pattern insights        |
| `/habits`          | Habits         | Habit tracking          |

### Lazy Loading

All page components are lazy-loaded using React's `lazy()` function with a `Suspense` boundary for loading states. This improves initial load time by splitting code into route-based chunks.

## State Management and Context Providers

### AppContext

The primary state management is handled by `AppContext` defined in `src/context/AppContext.tsx`.

**State Managed:**

- `dailyScore`: Current day's wellness score
- `logs`: Array of wellness log entries
- `habits`: Array of habit definitions
- `userProfile`: User profile information (name, email, avatar)
- `isLoading`: Loading state for data fetches
- `hasSeenOnboarding`: Onboarding completion flag
- `isAuthenticated`: Authentication status

**Actions Provided:**

- `addLog`: Add a new wellness log
- `toggleHabitToday`: Toggle habit completion for today
- `updateUserProfile`: Update user profile data
- `refreshData`: Refresh all data from backend
- `resetData`: Clear all logs
- `deleteAccount`: Delete user account
- `logout`: Log out user and clear state
- `finishOnboarding`: Mark onboarding as complete

### Context Implementation

- Context is provided at the root level in `App.tsx`
- Uses `useEffect` to refresh data on component mount
- Uses `useCallback` to memoize functions
- Persists `hasSeenOnboarding` in localStorage
- Manages authentication state with token storage

## UI Component Organization

### Component Hierarchy

```
App
└── MainLayout
    ├── Navigation
    └── Route Components
        ├── Home
        ├── Analysis
        ├── CheckIn
        ├── Habits
        ├── Insights
        ├── Profile
        └── Auth Pages
```

### Reusable Components

**Gauge (`src/components/Gauge.tsx`):**

- Circular progress indicator
- Used for wellness score visualization
- Customizable size, color, and value

**Navigation (`src/components/Navigation.tsx`):**

- Bottom navigation bar for mobile-first design
- Highlights active route
- Provides links to main sections

**Layout Components (`src/components/layout/`):**

- `MainLayout`: Wraps all pages with navigation and consistent layout
- Ensures consistent padding and spacing

**Coach Components (`src/components/coach/`):**

- Specialized components for AI coach interface
- Chat bubbles, voice input controls, audio player

## API Client and Request Handling

### HTTP Service (`src/services/http.service.ts`)

The `httpRequest` function provides a unified API client with:

**Features:**

- Automatic JSON parsing and error handling
- Configurable timeout (default 30 seconds)
- Automatic token injection from auth service
- Request/response logging in development
- Standardized error messages

**Usage:**

```typescript
import { httpRequest } from "./services/http.service";

const data = await httpRequest<ResponseType>("/api/v1/endpoint", {
  method: "POST",
  body: { key: "value" },
});
```

### Service Layer

Each API domain has a dedicated service:

- `auth.service.ts`: Authentication (login, register, logout)
- `coach.service.ts`: AI coach interactions
- `habits.service.ts`: Habit CRUD operations
- `logs.service.ts`: Wellness log management
- `user.service.ts`: User profile operations

**Service Pattern:**

- Export functions that use `httpRequest`
- Include TypeScript interfaces for request/response types
- Handle domain-specific error cases
- Token management via auth service

## Authentication State and Token Handling

### Token Storage

- JWT access tokens stored in localStorage
- Token key: `auth_token`
- Automatically included in request headers via auth service

### Authentication Check

- `isAuthenticated()` function checks for token presence
- Token is sent in `Authorization: Bearer <token>` header
- AppContext refreshes data on mount if authenticated
- Unauthorized responses trigger logout and redirect

### Token Lifecycle

1. User logs in → Token stored in localStorage
2. AppContext checks token on mount → Refreshes data
3. Each API request includes token in header
4. 401 responses → Token cleared, user logged out
5. User logs out → Token cleared, state reset

## Form Validation and User-Input Handling

### Form Validation Strategy

- Native HTML5 validation for basic constraints (required, email format)
- Backend validation via Pydantic schemas
- Client-side validation in service layer before API calls
- Error messages displayed from backend responses

### Input Handling

- Controlled components for form inputs
- State management in page components
- Validation feedback from API errors
- Password confirmation checks on client side

## Loading, Error, and Empty States

### Loading States

- Global `isLoading` in AppContext for data fetches
- Route-level loading fallback in Suspense
- Button loading states during form submissions
- Skeleton screens not currently implemented

### Error Handling

- HTTP errors caught in `httpRequest`
- Error messages extracted from response payload
- User-friendly error messages displayed
- Network errors handled with retry suggestions

### Empty States

- Empty log list shows "No logs yet" message
- Empty habit list shows "No habits yet" message
- Empty profile shows default avatar and placeholder data

## Frontend Environment Variables and Build-Time Configuration

### Environment Variables

Frontend uses Vite's environment variable system with `VITE_` prefix:

- `VITE_API_URL`: Backend API base URL (default: `http://localhost:8000/api/v1`)
- `VITE_FRONTEND_URL`: Frontend base URL (default: `http://localhost:3000`)

### Configuration Files

**`src/constants/api.ts`:**

- API configuration constants
- Timeout settings
- Default headers

**`vite.config.ts`:**

- Build output directory: `dist/`
- Source directory: `src/`
- Path aliases: `@` → `src/`
- Development server: port 3000, host 0.0.0.0
- Code splitting: vendor chunks for React and Recharts

## Frontend Build and Verification Commands

### Available Scripts

```bash
# Development server
pnpm frontend    # Starts Vite dev server on port 3000

# Type checking
pnpm run lint    # TypeScript compilation check (no emit)

# Building
pnpm run build   # Production build to dist/

# Preview
pnpm run preview # Preview production build locally

# Formatting
pnpm run format  # Format code with Prettier

# Full check
pnpm run check   # Run lint + build
```

### Build Process

1. TypeScript compilation with project references
2. Vite bundling with code splitting
3. Asset optimization and minification
4. Output to `dist/` directory
5. Manual chunk configuration for vendor libraries

### Verification

- `pnpm run lint` verifies TypeScript types
- `pnpm run build` verifies production build succeeds
- No automated frontend tests currently implemented

## Communication with Backend

### API Communication Pattern

1. User interaction → Page component
2. Page component → Service function
3. Service function → `httpRequest`
4. `httpRequest` → Backend API (with auth token)
5. Backend response → `httpRequest` (parsed JSON)
6. Parsed response → Service function
7. Service function → Page component
8. Page component → State update

### Error Handling Flow

1. API error → `httpRequest` catches error
2. Error message extracted from response
3. Error thrown with message and status
4. Service function catches or propagates error
5. Page component displays error to user
6. User can retry or correct input

### Real-Time Features

- Voice recording: Client-side audio capture
- Audio quality analysis: Client-side processing
- Language detection: Client-side text analysis
- No WebSocket or SSE currently implemented

## Relevant Limitations and Technical Debt

### Current Limitations

1. **No Frontend Tests:** No unit, integration, or E2E tests implemented
2. **Global State Complexity:** AppContext manages many concerns; consider splitting
3. **No Error Boundaries:** React error boundaries not implemented
4. **No Retry Logic:** Failed requests do not automatically retry
5. **No Request Caching:** API responses not cached in frontend
6. **No Offline Support:** No service worker or offline mode
7. **No Analytics:** No user analytics or error tracking

### Technical Debt

1. **Type Inconsistencies:** Some types may not match backend schemas exactly
2. **Prop Drilling:** Some props passed through multiple component layers
3. **Component Size:** Some page components are large and could be split
4. **Hardcoded Strings:** Some UI strings not extracted to constants
5. **No Component Library:** UI components built from scratch without library

### Recommended Improvements

1. Add React Testing Library for component testing
2. Implement error boundaries for graceful error handling
3. Add request retry logic with exponential backoff
4. Implement response caching for static data
5. Add service worker for offline support
6. Integrate analytics (e.g., Plausible, PostHog)
7. Consider component library (e.g., shadcn/ui, Radix UI)
8. Extract UI strings to i18n system for true localization
