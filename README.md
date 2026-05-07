# NeuroPattern LifeTracker 🧠

An AI-powered life tracking application that analyzes voice check-ins, tracks habits, and provides personalized mental health insights using advanced language models.

![NeuroPattern](https://img.shields.io/badge/NeuroPattern-2.4.0-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-009688)
![React](https://img.shields.io/badge/React-19-61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

## ✨ Features

- 🔐 **Secure Authentication** - JWT-based auth with password reset via email
- 🎙️ **Voice Check-ins** - AI-powered voice analysis using Groq (Llama 3.3)
- 🤖 **AI Life Coach (Nova)** - Conversational AI for personalized coaching
- 📊 **Life Score Analytics** - 0-100 scoring system with trend analysis
- 📈 **Interactive Charts** - Recharts-powered data visualization
- 🎯 **Habit Tracking** - Weekly habit heatmaps with progress tracking
- 🔊 **Voice Responses** - ElevenLabs text-to-speech integration
- 📱 **Responsive Design** - Mobile-first dark mode UI
- 📧 **Email Services** - SMTP password reset and notifications

## 🚀 Tech Stack

### Frontend
- **React 19** with TypeScript
- **Vite** (build tool)
- **Tailwind CSS** (styling)
- **React Router DOM** (routing)
- **Recharts** (data visualization)
- **Material Symbols** (icons)

### Backend
- **FastAPI** (Python web framework)
- **SQLAlchemy 2.0** (ORM)
- **PostgreSQL** (database)
- **Pydantic** (data validation)
- **python-jose** (JWT handling)
- **passlib** (password hashing)

### AI Services
- **Groq API** - Llama 3.3 70B for mental health analysis
- **ElevenLabs API** - Voice synthesis for AI responses

## 🛠️ Setup Instructions

### Prerequisites
- Python 3.9+
- Node.js 18+
- PostgreSQL 15+
- Git

### 1. Clone & Navigate
```bash
git clone &lt;repository-url&gt;
cd neuropattern-lifetracker

### Generate secure keys:
1. python3 -c "import secrets; print(f'SECRET_KEY={secrets.token_urlsafe(32)}\nJWT_SECRET_KEY={secrets.token_urlsafe(32)}')"

### Create database neuropattern_db
1. createdb neuropattern_db
psql -U postgres -d neuropattern_db -f backend/database/neuropatternLifetracker_db.sql

2. Run backend/database/neuropatternLifetracker_db.sql

3. createdb neuropattern_db
psql -U postgres -d neuropattern_db -f backend/database/neuropatternLifetracker_db.sql

### Backend Setup

# Create virtual environment
python -m venv venv

# Activate (Mac/Linux)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate

# Upgrade pip & install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Start server
uvicorn backend.main:app --reload --port 8000

### Frontend Setup

# Install dependencies
npm install

# Start development server
npm run dev

# Or run both frontend and backend concurrently
npm run dev:all


