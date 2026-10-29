# 🎙️ InterviewAgent-E2E

> **An End-to-End Autonomous AI Voice Interviewing, Proctoring, & Talent Recruitment Platform**

InterviewAgent-E2E is a full-stack, enterprise-grade recruitment and automated interview platform. It combines real-time conversational AI voice agents, smart candidate and recruiter portals, automated resume parsing, an intelligent in-browser proctoring engine, and deep competency evaluation reports.

---

## 🌟 Key Features

### 1. 👥 Dual-Portal Architecture
* **Candidate Portal (`/candidate`)**:
  * Secure candidate authentication (Sign Up / Sign In).
  * Comprehensive candidate profile: contact information, education, college details, work experience, projects with tech stacks, achievements, and skills.
  * **Student Profile Photo Upload**: Upload and preview profile photos used for identity verification.
  * **Intelligent Resume Parser**: Automatically extracts candidate contact info, college, education, work experience, projects, and achievements from uploaded files or text.
  * **Job Board**: Browse company job openings and apply with 1-click.
  * **Candidate Interview Hub**: View upcoming and completed interview sessions and launch live interviews directly.

* **Recruiter Portal (`/recruiter`)**:
  * Recruiter authentication and team management.
  * **Recruitment Analytics Dashboard**: Track total active jobs, applicants, completed interviews, and shortlisting rates.
  * **Job Management**: Create, edit, and publish job listings with competency requirements, experience levels, and salary ranges.
  * **Applicant Review & Shortlisting**: Inspect candidate profiles, photos, and parsed resumes. Shortlist or reject candidates with automated email updates.
  * **Interview Invitations**: Create AI interview sessions and generate direct links for shortlisted candidates.
  * **Evaluation Reports**: Review comprehensive candidate performance scorecards and proctoring audit logs.

---

### 2. 🤖 Autonomous Real-Time Voice Interviewer (`/interview/[id]`)
* **Real-Time Voice Streaming**: Ultra-low-latency two-way conversational voice loop powered by LiveKit WebRTC, Deepgram STT, and Cartesia / ElevenLabs / Kokoro TTS.
* **Context-Aware Interviewer Persona**: Dynamically adapts questions based on the candidate's specific resume, projects, and target job competencies.
* **Smart Follow-Ups & Interruptions**: Listens, processes responses, asks clarifying questions, and gracefully handles speech interruptions.
* **Live Transcription & Chat Fallback**: Real-time display of conversation turns with a typed fallback input for accessibility.
* **Automatic Session Completion**: Automatically detects when the interview concludes, closes media streams, exits fullscreen, and transitions to the scorecard report.

---

### 3. 🛡️ Three-Layer Anti-Cheating & Proctoring System (`<InterviewProctor>`)
* **🖥️ Fullscreen Gate & Enforcement**:
  * Blocks interview initiation until the candidate enters fullscreen mode.
  * Detects fullscreen exits immediately and presents a blocking warning overlay.
  * Automatically exits fullscreen upon interview completion or cancellation.
* **👁️ Tab & Window Focus Tracking**:
  * Listens to `visibilitychange` and window `blur` events to detect tab switching or window minimizing.
  * Records violation counts and flags suspicious behavior in the recruiter's report.
* **📸 Live Webcam Face-Presence Verification**:
  * Samples candidate webcam frames and extracts a 16-dimensional luminance/contrast feature vector.
  * Compares live frames with the candidate's uploaded profile photo using cosine similarity to detect absence or impersonation.
  * Strictly in-memory and privacy-preserving (no raw video or biometrics sent to external third parties).
  * Automatically stops all hardware camera and microphone tracks immediately when the interview concludes.

---

### 4. 📊 Comprehensive AI Evaluation & Scorecard (`/report/[id]`)
* **Competency Radar & Scores**: Multi-dimensional grading across problem-solving, system design, domain knowledge, and communication.
* **Strengths & Gaps Analysis**: Identifies clear strengths and highlights areas requiring improvement.
* **Benchmark Model Answers**: Provides ideal model responses to the specific questions asked during the session.
* **Full Transcript History**: Time-aligned, turn-by-turn conversation log between candidate and interviewer.

---

## 🏗️ System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 15 Web App                     │
│  Candidate Portal   •   Recruiter Portal   •   Live Room    │
│  (/candidate)           (/recruiter)           (/interview) │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
       REST / Auth / Uploads             WebRTC / Live Audio
               │                               │
       ┌───────┴──────────────┐         ┌──────┴──────────────┐
       │   FastAPI Services   │         │ LiveKit Voice Agent │
       │  • Candidate Service │         │  • deepinterview    │
       │  • Recruiter Service │         │  • STT + LLM + TTS  │
       │  • Common Models/DB  │         └─────────────────────┘
       └──────────────┬───────┘
                      │
               SQLite Database
              (recruitment.db)
```

| Service | Port | Description |
| :--- | :--- | :--- |
| **Next.js Web App** | `3000` | Front-end candidate & recruiter portal, live interview UI |
| **Candidate Service** | `8003` | Candidate auth, profile photo, resume parser, applications |
| **Recruiter Service** | `8004` | Recruiter auth, job postings, candidate shortlisting, analytics |
| **Voice Agent Worker** | LiveKit | Autonomous Python LiveKit voice interviewer worker |

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js**: v20+ and `pnpm`
* **Python**: v3.11+ and `uv`
* **LiveKit Server** (Local or LiveKit Cloud)

### 1. Clone & Setup Repository
```bash
git clone https://github.com/RitikKShahi/InterviewAgent-E2E.git
cd InterviewAgent-E2E
```

### 2. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```
Fill in the necessary API keys in `.env`:
* `OPENAI_API_KEY` or `GEMINI_API_KEY` (LLM interview questions & evaluation)
* `DEEPGRAM_API_KEY` (Live speech-to-text)
* `CARTESIA_API_KEY` or `ELEVENLABS_API_KEY` (Live text-to-speech)
* `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`

### 3. Install Dependencies
```bash
# Install JavaScript/TypeScript dependencies
pnpm install

# Install Python backend dependencies
cd services && pip install -r requirements.txt && cd ..
cd apps/agent && uv sync --extra livekit && cd ../..
```

### 4. Start the Entire Platform
You can run the entire platform with the provided helper script:
```bash
chmod +x start.sh stop.sh
./start.sh
```

Or start the individual components:
```bash
# Terminal 1: Candidate Service
python -m uvicorn services.candidate_service.main:app --port 8003 --reload

# Terminal 2: Recruiter Service
python -m uvicorn services.recruiter_service.main:app --port 8004 --reload

# Terminal 3: Next.js Frontend
pnpm --filter web dev

# Terminal 4: Voice Agent Worker
cd apps/agent && uv run python -m deepinterview_agent.worker dev
```

Visit **http://localhost:3000** to access the platform.

---

## 📱 Portals & URLs

* **Home / Landing Page**: `http://localhost:3000`
* **Candidate Login**: `http://localhost:3000/candidate/login`
* **Candidate Profile & Resume**: `http://localhost:3000/candidate/profile`
* **Candidate Job Board**: `http://localhost:3000/candidate/jobs`
* **Candidate Interviews**: `http://localhost:3000/candidate/interviews`
* **Recruiter Login**: `http://localhost:3000/recruiter/login`
* **Recruiter Dashboard**: `http://localhost:3000/recruiter/dashboard`
* **Recruiter Job Postings**: `http://localhost:3000/recruiter/jobs`
* **Candidate Live Interview**: `http://localhost:3000/interview/[id]`
* **Evaluation Report**: `http://localhost:3000/report/[id]`

---

## 🔒 Security & Privacy

* **Strict Token Authentication**: Role-based JWT authentication separating candidates and recruiters.
* **Client-Side Face Verification**: Webcam frames are analyzed locally in browser memory using HTML5 canvas histograms. No camera feed or biometric vectors are permanently stored on server disks.
* **Proctoring Incident Logs**: Timestamped violation logs (tab switches, fullscreen exits, face absence) are securely transmitted only to authorized hiring teams.
* **Automatic Hardware Cleanup**: Explicit camera and microphone track termination upon session end prevents any camera or microphone hardware leaks.

---

## 📄 License
This project is licensed under the Apache 2.0 License.
