# Trade Insights

A comprehensive trading journal and analytics platform for tracking and analyzing trading performance.

## Features

- Advanced trading metrics (Sharpe ratio, profit factor, expectancy)
- Performance analytics by session, strategy, and setup
- Psychological pattern recognition
- Trading journal with detailed insights
- Real-time performance tracking

## Deployment Options

1. **Static Hosting (Recommended for initial deployment)**:
   - Vercel
   - Netlify
   - GitHub Pages

2. **Full-Stack Hosting (For future database integration)**:
   - Railway
   - Render
   - DigitalOcean

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```
VITE_APP_NAME=Trade Insights
VITE_APP_VERSION=1.0.0
```

## Deployment Steps

1. Build the application:
   ```bash
   npm run prepare-deploy
   ```

2. Choose a deployment platform:
   - For Vercel: Connect GitHub repository and deploy
   - For Netlify: Connect repository or drag-and-drop `dist` folder
   - For GitHub Pages: Push to gh-pages branch

## Future Enhancements

1. Database Integration
2. User Authentication
3. Real-time Market Data
4. Mobile App Version
5. API Integration
6. Multi-Account Support

## License

MIT
