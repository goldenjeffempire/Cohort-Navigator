# AI API Reference

Base URL: `/api`

All endpoints require authentication (Clerk session cookie or JWT).
Streaming endpoints use SSE (Server-Sent Events): `Content-Type: text/event-stream`.

---

## Conversations (Learning Assistant)

### List Conversations
```
GET /ai/conversations
Auth: any user

Response: AIConversation[]
```

### Create Conversation
```
POST /ai/conversations
Auth: any user

Body:
{
  "mode": "tutor" | "code" | "assignment" | "interview" | "career" | "quiz" | "review" | "general",
  "title": "string",
  "courseId": number?,
  "lessonId": number?,
  "challengeId": number?,
  "assignmentId": number?
}

Response: AIConversation
```

### Get Conversation with Messages
```
GET /ai/conversations/:id
Auth: owner only

Response: AIConversation & { messages: AIMessage[] }
```

### Delete Conversation
```
DELETE /ai/conversations/:id
Auth: owner only

Response: 204 No Content
```

### Send Message (SSE Stream)
```
POST /ai/conversations/:id/messages
Auth: owner only

Body:
{
  "content": "string",
  "context": {
    "courseName": "string?",
    "lessonTitle": "string?",
    "challengeTitle": "string?",
    "challengeLanguage": "string?"
  }
}

SSE Events:
data: {"content": "chunk text"}
data: {"done": true, "messageId": 42}
data: {"error": "message", "done": true}
```

### Submit Message Feedback
```
POST /ai/messages/:id/feedback
Auth: any user

Body: { "rating": 1-5, "helpful": boolean?, "comment": "string?" }
Response: AIFeedback
```

---

## Code Assistant

### Analyse Code (Instant, Rule-Based)
```
POST /ai/code/analyze
Auth: any user

Body: { "code": "string", "language": "javascript" }

Response: CodeQualityReport {
  score: number,        // 0-100
  grade: "A"|"B"|"C"|"D"|"F",
  metrics: CodeMetrics,
  issues: CodeIssue[],
  suggestions: string[],
  summary: string
}
```

### Explain Code (SSE Stream)
```
POST /ai/code/explain
Auth: any user

Body: { "code": "string", "language": "string", "question": "string?" }
SSE: streaming explanation
```

### Get Challenge Hint (SSE Stream, No Answer Reveal)
```
POST /ai/code/hint
Auth: any user

Body: {
  "code": "string",
  "language": "string",
  "challengeTitle": "string?",
  "problemDescription": "string?"
}
SSE: streaming hint (guided, no direct solution)
```

### Full Code Review (SSE Stream)
```
POST /ai/code/review
Auth: any user

Body: { "code": "string", "language": "string", "context": "string?" }
SSE: streaming structured review (correctness, quality, security, etc.)
```

---

## Specialised AI Tools

### Assignment Feedback (SSE Stream)
```
POST /ai/assignment/feedback
Auth: any user

Body: {
  "submissionText": "string",
  "assignmentTitle": "string?",
  "rubric": Record<string, number>?,  // e.g. {"correctness": 40, "quality": 30}
  "language": "string?"
}
SSE: streaming feedback with score estimate
```

### Generate Interview Question (SSE Stream)
```
POST /ai/interview/question
Auth: any user

Body: {
  "topic": "string",
  "difficulty": "easy" | "medium" | "hard",
  "type": "technical" | "behavioral" | "coding",
  "previousQuestions": string[]
}
SSE: structured interview question with expected key points
```

### Evaluate Interview Answer (SSE Stream)
```
POST /ai/interview/evaluate
Auth: any user

Body: {
  "question": "string",
  "answer": "string",
  "expectedKeyPoints": string[]
}
SSE: structured evaluation (score/10, strengths, gaps, model answer)
```

### Start Interview Session
```
POST /ai/interview/session/start
Auth: any user

Body: {
  "sessionType": "technical" | "behavioral" | "coding" | "mixed",
  "topic": "string?",
  "difficulty": "easy" | "medium" | "hard",
  "questionCount": number  // default 5
}

Response: { sessionId: number, firstQuestion: string }
```

### Submit Session Answer (SSE Stream)
```
POST /ai/interview/session/:id/answer
Auth: session owner

Body: { "answer": "string" }
SSE: evaluation + next question (or session complete)
```

### Get Session Report
```
GET /ai/interview/session/:id/report
Auth: session owner

Response: {
  session: AIInterviewSession,
  report: {
    overallScore: number,
    grade: string,
    strengths: string[],
    improvements: string[],
    recommendations: string[],
    readinessLevel: string
  }
}
```

### Career Analysis (SSE Stream)
```
POST /ai/career/analyze
Auth: any user

Body: {
  "resumeText": "string?",
  "githubUrl": "string?",
  "linkedinUrl": "string?",
  "targetRole": "string?",
  "currentLevel": "junior" | "mid" | "senior"
}
SSE: structured career analysis (score, gaps, roadmap, action plan)
```

### Generate Quiz (SSE Stream)
```
POST /ai/quiz/generate
Auth: any user

Body: {
  "topic": "string",
  "difficulty": "easy" | "medium" | "hard",
  "count": number,    // default 5, max 20
  "format": "mixed" | "multiple-choice" | "short-answer" | "coding"
}
SSE: numbered questions with answers and explanations
```

### Generate Learning Content (SSE Stream)
```
POST /ai/content/generate
Auth: admin | mentor

Body: {
  "type": "summary" | "flashcards" | "exercise" | "notes" | "challenge",
  "topic": "string",
  "audience": "beginner" | "intermediate" | "advanced",
  "length": "short" | "medium" | "long"
}
SSE: generated content of the requested type
```

### Get Learning Path (SSE Stream)
```
POST /ai/learning/path
Auth: any user

Body: {
  "goalRole": "string",
  "timelineWeeks": number,
  "currentSkills": string[]
}
SSE: week-by-week personalised learning roadmap
```

### Get Learning Insights
```
GET /ai/learning/insights
Auth: any user

Response: {
  "insights": LearningInsight[]  // type, topic, detail, priority
}
```

---

## Personalised Learning

### Get Learning Profile
```
GET /ai/learning/profile
Auth: any user (own profile)

Response: AILearningProfile {
  skillScores: Record<string, number>,
  weakTopics: string[],
  strongTopics: string[],
  learningVelocity: number,
  riskLevel: string,
  competencyScore: number,
  recommendations: LearningRecommendation[]
}
```

### Record Skill Assessment
```
POST /ai/learning/skill-assessment
Auth: any user

Body: {
  "skillArea": "string",
  "score": number,
  "source": "challenge" | "quiz" | "assignment",
  "sourceId": number?
}
Response: { updated: true, newScore: number }
```

### Get Recommendations
```
GET /ai/learning/recommendations
Auth: any user

Response: { recommendations: LearningRecommendation[] }
```

### Performance Forecast
```
GET /ai/learning/forecast
Auth: any user

Response: PerformanceForecast {
  predictedCompetencyScore: number,
  confidenceLevel: string,
  weeksToTargetScore: number | null,
  trend: "improving" | "stable" | "declining",
  onTrackForCompletion: boolean
}
```

---

## Analytics

### Student Analytics
```
GET /ai/analytics/student/:userId
Auth: own user, or admin/mentor

Response: StudentAnalyticsSummary
```

### Cohort Analytics
```
GET /ai/analytics/cohort/:cohortId
Auth: admin | mentor

Response: CohortAnalytics
```

### Platform Analytics
```
GET /ai/analytics/platform
Auth: admin

Response: { students, cohorts, aiUsage, topCourses }
```

---

## Knowledge Base

### Semantic Search
```
GET /ai/knowledge/search?q=<query>&limit=<5>
Auth: any user

Response: Array<{ id, title, content, score, lexicalScore, semanticScore }>
```

### Index Document
```
POST /ai/knowledge/index
Auth: admin | mentor

Body: { sourceType, sourceId, title, content, tags?, language? }
Response: { indexed: number, message: string }
```

### Sync All Course Content
```
POST /ai/knowledge/sync
Auth: admin

Response: { indexed: number, errors: string[], message: string }
```

### Knowledge Stats
```
GET /ai/knowledge/stats
Auth: admin

Response: { totalChunks: number, bySource: Record<string, number> }
```

### Delete from Index
```
DELETE /ai/knowledge/:sourceType/:sourceId
Auth: admin

Response: { message: string }
```

---

## Admin

### Engine Status
```
GET /ai/admin/status
Auth: admin

Response: {
  mode: "local_model" | "built_in_rag",
  localModelEndpoint: string | null,
  localOnline: boolean,
  registry: { models: number },
  usage: { conversations: number, messages: number },
  cacheStats: { response: CacheStats, knowledge: CacheStats },
  version: string
}
```

### Models CRUD
```
GET    /ai/admin/models                  → list all
POST   /ai/admin/models                  → register
PATCH  /ai/admin/models/:id              → update config
DELETE /ai/admin/models/:id              → remove
POST   /ai/admin/models/:id/activate     → set as default
POST   /ai/admin/models/:id/evaluate     → run eval suite
GET    /ai/admin/models/:id/evaluations  → eval history
```

### Prompt Templates
```
GET    /ai/admin/prompts        → list all
POST   /ai/admin/prompts        → create
PATCH  /ai/admin/prompts/:id    → update (auto-increments version)
```

### Analytics & Monitoring
```
GET /ai/admin/audit             → audit log (last 50-200 events)
GET /ai/admin/metrics           → usage metrics (last 30 days)
GET /ai/admin/analytics         → platform AI analytics
GET /ai/admin/feedback          → collected feedback (last 100)
```
