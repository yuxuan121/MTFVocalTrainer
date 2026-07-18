# Project Structure

```
MTF Vocal PWA/
│
├── 📄 README.md                    # Full documentation
├── 📄 QUICKSTART.md               # Quick setup guide
├── 📄 NEXT_STEPS.md               # What to do next
├── 📄 PROJECT_STRUCTURE.md        # This file
├── 📄 package.json                # NPM dependencies
├── 📄 vercel.json                 # Vercel deployment config
├── 📄 setup.js                    # Setup script
├── 📄 .gitignore                  # Git ignore rules
│
└── public/                        # 🌐 All deployable files
    │
    ├── 📄 index.html              # Main HTML file
    ├── 📄 manifest.json           # PWA manifest
    ├── 📄 service-worker.js       # Offline support
    │
    ├── css/
    │   └── 📄 styles.css          # All app styles
    │
    ├── js/                        # JavaScript modules
    │   ├── 📄 app.js              # Main application controller
    │   ├── 📄 audio.js            # Web Audio API wrapper
    │   ├── 📄 pitch-detector.js   # Pitch detection logic
    │   ├── 📄 formant-analyzer.js # Formant analysis wrapper
    │   ├── 📄 gamification.js     # Achievements & scoring
    │   ├── 📄 storage.js          # LocalStorage management
    │   └── 📄 charts.js           # Canvas-based visualization
    │
    ├── lib/                       # External libraries
    │   └── 📄 formantanalyzer.min.js  # Formant analysis (LPC)
    │   # Note: Pitchfinder loaded from CDN
    │
    └── assets/
        └── icons/                 # PWA icons
            ├── 🎨 icon-192x192.svg
            └── 🎨 icon-512x512.svg
```

## File Descriptions

### Root Configuration Files

- **README.md** - Complete documentation with setup instructions, features, and troubleshooting
- **QUICKSTART.md** - Fast 5-minute setup guide
- **NEXT_STEPS.md** - What to do now that setup is complete
- **package.json** - NPM configuration with scripts and dependencies
- **vercel.json** - Vercel deployment configuration
- **setup.js** - Automated setup script (downloads libraries, creates icons)
- **.gitignore** - Files to exclude from git

### public/ - Deployable Application

#### HTML & PWA Config
- **index.html** - Main app with all screens (home, sections, settings, etc.)
- **manifest.json** - PWA configuration (name, icons, colors, display mode)
- **service-worker.js** - Caches resources for offline use

#### CSS
- **styles.css** - Complete styling including:
  - Responsive design (mobile, tablet, desktop)
  - Dark theme
  - Animations and transitions
  - Component styles

#### JavaScript Modules

**app.js** (Main Controller)
- Application initialization
- Screen navigation
- Exercise flow management
- UI updates
- Achievement notifications

**audio.js** (Audio Manager)
- Web Audio API setup
- Microphone access
- Real-time audio capture
- Sample rate management

**pitch-detector.js** (Pitch Detection)
- Autocorrelation algorithm
- Frequency detection
- Pitch averaging
- Standard deviation calculation
- Note conversion utilities

**formant-analyzer.js** (Formant Analysis)
- Formant extraction (F1, F2, F3)
- Resonance stability calculation
- Brightness ratio
- LPC wrapper

**gamification.js** (Game Mechanics)
- Achievement definitions
- Scoring algorithms
- XP and level system
- Streak tracking

**storage.js** (Data Persistence)
- LocalStorage wrapper
- User settings management
- Progress tracking
- History storage
- Export/import functionality

**charts.js** (Visualization)
- Canvas-based charts
- Progress bars
- Line charts
- Streak calendar
- Pitch meter

#### Libraries
- **formantanalyzer.min.js** - Linear Predictive Coding for formant extraction
- **Pitchfinder** (CDN) - Pitch detection algorithms (YIN, autocorrelation)

#### Assets
- **SVG Icons** - Scalable vector icons for PWA (can be converted to PNG)

## Technology Stack

### Frontend
- **HTML5** - Semantic structure
- **CSS3** - Custom styling, no frameworks
- **JavaScript (ES6+)** - Vanilla JS, no frameworks

### Audio Processing
- **Web Audio API** - Browser native audio
- **Autocorrelation** - Pitch detection (YIN algorithm)
- **LPC** - Formant extraction

### Storage
- **LocalStorage** - Client-side data persistence
- **JSON** - Data format

### PWA Features
- **Service Worker** - Offline functionality
- **Manifest** - Installable app
- **Canvas API** - Charts and visualization

## Code Organization

### Module Pattern
Each JavaScript file exports a class or object to `window` for cross-module communication:
```javascript
// In storage.js
class Storage { ... }
window.Storage = Storage;

// In app.js
const storage = new Storage();
```

### Data Flow
```
User Interaction
    ↓
app.js (Controller)
    ↓
audio.js → pitch-detector.js → Results
    ↓           ↓
    ↓      formant-analyzer.js
    ↓
gamification.js (Scoring)
    ↓
storage.js (Save Progress)
    ↓
charts.js (Visualization)
```

### Exercise Flow
1. User clicks "Start Exercise"
2. app.js initializes exercise state
3. audio.js starts microphone recording
4. Raw audio → pitch-detector.js or formant-analyzer.js
5. Results displayed in real-time
6. User clicks "Stop"
7. Calculate final score
8. Award XP, check achievements
9. Save to storage
10. Update UI and charts

## Development

### Local Development
```bash
npm run dev       # Start at localhost:3000
```

### Deployment
```bash
vercel            # Deploy to Vercel
```

### Adding New Features

#### New Section
1. Add HTML in `index.html`
2. Add styles in `styles.css`
3. Add logic in `app.js`:
   - `renderSectionX()`
   - `startSectionXExercise()`
   - `stopSectionXExercise()`
4. Update storage schema in `storage.js`

#### New Achievement
1. Add to `gamification.js`:
   ```javascript
   myAchievement: {
     id: 'myAchievement',
     name: 'My Achievement',
     description: 'Do something cool',
     icon: '🎉',
     xpReward: 100
   }
   ```
2. Add check in `app.js` after relevant action

#### New Chart Type
1. Add method to `charts.js`:
   ```javascript
   drawMyChart(canvas, data) { ... }
   ```
2. Call from screen render function in `app.js`

## Performance Considerations

- **Audio Processing**: 44.1kHz sample rate, 2048 buffer size
- **Storage**: LocalStorage has ~5-10MB limit (sufficient for this app)
- **Charts**: Canvas-based (hardware accelerated)
- **Service Worker**: Caches static assets (~500KB total)

## Browser Compatibility

- ✅ Chrome 80+
- ✅ Edge 80+
- ✅ Firefox 75+
- ✅ Safari 14+
- ⚠️ Mobile browsers (requires HTTPS for mic access)

## Security

- 🔒 HTTPS required for microphone access (except localhost)
- 🔒 No external data transmission (all local)
- 🔒 No analytics or tracking
- 🔒 CORS headers configured in vercel.json

---

**Total Size**: ~1MB including libraries
**Load Time**: <2 seconds on 3G
**Offline**: Fully functional after first load

