# Voice Feminization Trainer PWA 🎤

A Progressive Web App designed to help with voice feminization training through structured pitch, resonance, and speech exercises.

## Features

### 🎯 Section I: Pitch Practice
- Hit and sustain your target note (default: E3 @ 164.81Hz)
- Real-time pitch detection and visual feedback
- Gamified scoring based on accuracy, speed, and stability
- Track standard deviation to ensure consistency

### 🔮 Section II: Resonance Training
- Master throat posture using the silent "K" technique
- Real-time formant analysis (F1, F2, F3)
- Monitor resonance stability (<10% target)
- Brightness ratio feedback

### 📖 Section III: Word Practice
- Progressive difficulty: Vowels → Words → Phrases
- Combined pitch and resonance requirements
- Track completed words and unlock new levels

### 🏆 Gamification
- XP and level system
- 15+ achievements to unlock
- Daily streak tracking with GitHub-style calendar
- Streak multipliers (2x at 7 days, 3x at 30 days)
- Streak freeze system

### 📊 Progress Tracking
- Visual charts for pitch and resonance history
- Session statistics
- Export/import data

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Download Required Libraries

You need to manually download two JavaScript libraries:

#### Pitchfinder
1. Go to https://github.com/peterkhayes/pitchfinder
2. Download the release or build from source
3. Save as `public/lib/pitchfinder.min.js`

**OR** use CDN by updating `index.html`:
```html
<script src="https://unpkg.com/pitchfinder@2.3.0/dist/pitchfinder.min.js"></script>
```

#### FormantAnalyzer
1. Go to https://github.com/tabahi/formantanalyzer.js
2. Download the built file
3. Save as `public/lib/formantanalyzer.min.js`

**OR** install via npm and copy to public:
```bash
npm install formantanalyzer
cp node_modules/formantanalyzer/dist/formantanalyzer.min.js public/lib/
```

### 3. Create PWA Icons

Create icons for your PWA:
- `public/assets/icons/icon-192x192.png` (192x192 pixels)
- `public/assets/icons/icon-512x512.png` (512x512 pixels)

You can use any icon generator or create custom ones. Simple placeholder:
```bash
# On Windows with ImageMagick installed:
magick -size 192x192 xc:#e94560 public/assets/icons/icon-192x192.png
magick -size 512x512 xc:#e94560 public/assets/icons/icon-512x512.png
```

Or use an online tool like https://www.pwabuilder.com/ to generate icons from a base image.

### 4. Run Locally

```bash
npm run dev
```

This will start a local server at http://localhost:3000

### 5. Deploy to Vercel

#### Option A: Using Vercel CLI
```bash
npm install -g vercel
vercel
```

#### Option B: Using Vercel Dashboard
1. Go to https://vercel.com
2. Click "New Project"
3. Import your Git repository
4. Vercel will auto-detect the configuration
5. Click "Deploy"

The app will be deployed from the `public/` folder automatically.

## Browser Requirements

- Modern browser with Web Audio API support (Chrome, Firefox, Edge, Safari)
- Microphone access required
- HTTPS required for PWA features (local development works on localhost)

## Usage

### First Time Setup
1. Allow microphone access when prompted
2. The app will initialize with default settings (E3 target note)
3. Start with Section I: Pitch Practice

### Target Note Configuration
1. Go to Settings (⚙️ icon)
2. Select your target note from the dropdown
3. Common starting points:
   - E3 (164.81 Hz) - Default
   - F3 (174.61 Hz)
   - G3 (196.00 Hz)

### Section Progression
- **Section II** unlocks when you achieve <10Hz standard deviation in Section I
- **Section III** unlocks when you achieve <10% resonance stability in Section II

### Daily Practice
- Practice at least 5 minutes per day to maintain your streak
- Earn streak freezes every 7 days
- Use streak freezes to skip a day without breaking your streak

## Technical Details

### Architecture
- **Frontend**: Vanilla JavaScript (no framework)
- **Audio**: Web Audio API
- **Pitch Detection**: Autocorrelation algorithm (YIN)
- **Formant Analysis**: Linear Predictive Coding (LPC)
- **Storage**: LocalStorage
- **PWA**: Service Worker for offline support

### File Structure
```
public/
├── index.html              # Main HTML
├── manifest.json           # PWA manifest
├── service-worker.js       # Service worker for offline
├── css/
│   └── styles.css         # All styles
├── js/
│   ├── app.js             # Main application controller
│   ├── audio.js           # Web Audio API wrapper
│   ├── pitch-detector.js  # Pitch detection logic
│   ├── formant-analyzer.js # Formant analysis wrapper
│   ├── gamification.js    # Achievements and scoring
│   ├── storage.js         # LocalStorage management
│   └── charts.js          # Canvas-based charts
├── lib/
│   ├── pitchfinder.min.js
│   └── formantanalyzer.min.js
└── assets/
    └── icons/
        ├── icon-192x192.png
        └── icon-512x512.png
```

### Performance Considerations
- Audio processing runs at 44.1kHz sample rate
- Buffer size: 2048 samples
- Real-time analysis with minimal latency
- Offline-capable via service worker

## Troubleshooting

### Microphone Not Working
- Ensure microphone permissions are granted
- Check browser console for errors
- Try refreshing the page
- On mobile, ensure you're using HTTPS

### No Sound Detection
- Check microphone is not muted
- Speak/hum louder
- Check browser audio settings
- Try a different microphone

### Libraries Not Loading
- Check browser console for 404 errors
- Ensure library files are in `public/lib/`
- Verify file names match exactly
- Try using CDN versions as fallback

### PWA Not Installing
- Ensure you're using HTTPS (or localhost)
- Check that manifest.json is valid
- Verify service worker is registered
- Check browser console for errors

## Data Privacy

- All data is stored locally in your browser
- No data is sent to any server
- Use Export/Import to backup your progress
- Clearing browser data will reset progress

## Credits

- Built with love for the trans community 🏳️‍⚧️
- Uses [Pitchfinder](https://github.com/peterkhayes/pitchfinder) for pitch detection
- Uses [FormantAnalyzer.js](https://github.com/tabahi/formantanalyzer.js) for formant analysis

## License

MIT License - Feel free to use and modify!

---

Made with 💖 for voice training
