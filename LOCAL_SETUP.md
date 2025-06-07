# Local Development Setup

## Quick Start

1. **Backend Setup**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   Backend will run on: http://localhost:3001

2. **Frontend Setup** (in new terminal)
   ```bash
   cd frontend
   npm start
   ```
   Frontend will run on: http://localhost:3000

## Environment Configuration

The app is currently configured to run without a database (see backend/.env):
- `ENABLE_DATABASE=false` - App uses API-only mode
- All data is fetched directly from MF API
- No local storage required

## Available Scripts

### Backend (from backend/ directory)
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm run test` - Run tests

### Frontend (from frontend/ directory)
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests

## Access Points

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Health Check: http://localhost:3001/api/health

## Features Available

1. **Fund Search & Comparison** - Compare up to 3 mutual funds
2. **SIP Calculator** - Calculate returns for multiple SIP investments
3. **Portfolio Builder** - Build and analyze investment portfolios
4. **Investment Analysis** - Detailed fund performance metrics

The app will fetch real-time data from the MF API service.