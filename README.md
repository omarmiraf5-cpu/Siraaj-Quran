# Siraaj Quran - Quranic School Management Portal

A dedicated platform for managing Quranic schools, featuring AI-powered Tajweed color coding, assignment tracking, and parent progress monitoring.

## Features

### 📖 For Students
- **Quranic Assignments** - View assigned Surahs with highlighted Ayahs
- **Tajweed Color Coding** - Interactive color-coded Quranic text with 8 recitation rules
- **Tajweed Rules Reference** - Learn the rules of proper Quranic recitation
- **Progress Tracking** - Track memorization level (0-100%)
- **Teacher Feedback** - View instructor notes and guidance

### 👨‍🏫 For Teachers
- **Create Assignments** - Assign any Surah/Ayah range to students
- **Due Dates** - Set submission deadlines
- **Teacher Notes** - Add guidance and feedback for students
- **Class Management** - Manage multiple students

### 👨‍👩‍👧‍👦 For Parents
- **Progress Dashboard** - Monitor child's Quranic journey
- **Assignment Tracking** - See all assignments, status, and due dates
- **Memorization Progress** - View completion rate and memorization levels
- **Teacher Communication** - Read teacher feedback and notes
- **Multi-Child Support** - Track multiple children

## Tajweed Rules

The platform features 8 Quranic recitation rules with color coding:

1. **🔴 Qalqalah** - Heavy/bouncing letters
2. **🔵 Ghunna** - Nasal resonance
3. **🟠 Idgham** - Letter merging
4. **🟢 Iqlab** - Converting noon/meem
5. **🟣 Istihaaza** - Difficult letters
6. **🟡 Tafkhim** - Emphatic pronunciation
7. **🩷 Hamza** - Glottal stops
8. **🟦 Madda** - Vowel elongation

Hover over any colored letter to learn the rule!

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Authentication**: Supabase Auth
- **API**: Quran.com API integration
- **Chat**: Claude AI assistant

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/omarmiraf5-cpu/Siraaj-Quran.git
cd Siraaj-Quran
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Add your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo Credentials

- **Admin**: admin@mydiiwaan.com / admin123
- **Teacher**: teacher@mydiiwaan.com / teacher123
- **Parent**: parent@mydiiwaan.com / parent123
- **Student**: Pin 1234, Name "Yusuf"

## Project Structure

```
src/
├── app/
│   ├── (student)        # Student portal
│   ├── (teacher)        # Teacher portal
│   ├── (parent)         # Parent portal
│   ├── api/             # API routes
│   └── auth/            # Authentication pages
├── components/          # Reusable React components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and helpers
│   ├── quran-api.ts    # Quran.com API integration
│   └── tajweed-rules.ts # Tajweed rule definitions
└── styles/             # Global styles
```

## Deployment

### Deploy to Vercel

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Connect your GitHub repository
4. Add environment variables
5. Deploy!

```bash
npm run build
```

## API Routes

- `GET /api/quranic-assignments` - Fetch student assignments
- `POST /api/quranic-assignments` - Create new assignment
- `PATCH /api/quranic-assignments/[id]` - Update assignment progress

## Database Schema

### quranic_assignments
- `id` - UUID primary key
- `student_id` - Reference to student
- `teacher_id` - Reference to teacher
- `surah` - Surah number (1-114)
- `ayah_start` - Starting Ayah
- `ayah_end` - Ending Ayah
- `status` - assigned | in_progress | completed | needs_review
- `memorization_level` - 0-100%
- `due_date` - Optional deadline
- `teacher_notes` - Feedback for student

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

**Made with ❤️ for Quranic education**
