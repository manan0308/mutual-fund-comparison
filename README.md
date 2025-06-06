# 🚀 Mutual Fund Comparison App

A **production-ready** mutual fund comparison application with real-time data integration, portfolio management, and advanced analytics.

[![Live API](https://img.shields.io/badge/API-Live-green)](https://api.mfapi.in)
[![React](https://img.shields.io/badge/React-18+-blue)](https://reactjs.org)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://docker.com)

## ✨ Features

### 🔥 Core Features
- **Real-time MF Data** - Live NAV and fund information from MFApi.in
- **Smart Fund Search** - Intelligent search with caching and performance optimization
- **Portfolio Comparison** - Compare multiple funds with detailed analytics
- **SIP Calculator** - Calculate returns for systematic investment plans
- **Performance Charts** - Interactive visualizations with Recharts

### 🆕 Advanced Features
- **Multi-fund Portfolio Builder** - Create diversified portfolios with custom allocation
- **Multi-fund SIP Calculator** - Plan SIP across multiple fund categories
- **Benchmark Comparison** - Compare portfolios against market indices
- **Risk Analysis** - Portfolio risk assessment and optimization suggestions

### 🛠️ Technical Features
- **Production-ready** - Error handling, logging, rate limiting, security
- **Intelligent Caching** - Memory + database caching for optimal performance
- **Database Optional** - Works with or without PostgreSQL
- **Docker Support** - Complete containerization for easy deployment
- **Health Monitoring** - Comprehensive health checks and monitoring

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- PostgreSQL (optional)

### 1. Clone Repository
```bash
git clone https://github.com/mananagarwal/mutual-fund-comparison.git
cd mutual-fund-comparison
```

### 2. Backend Setup
```bash
cd backend
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your settings (database is optional)
# ENABLE_DATABASE=false  # Set to true if using PostgreSQL

# Start backend
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install

# Start frontend
npm start
```

### 4. Access Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## 🐋 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Access at http://localhost:3000
```

## 📋 Environment Configuration

### Backend (.env)
```env
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000

# API Settings
MF_API_URL=https://api.mfapi.in/mf
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Database Settings (Optional)
ENABLE_DATABASE=false
DB_USER=your_username
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mf_comparison
CACHE_TTL_MINUTES=60
API_TIMEOUT_MS=10000
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:3001/api
```

## 🏗️ Architecture

```
mutual-fund-comparison/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   └── utils/          # Utilities
│   ├── .env               # Environment config
│   └── server.js          # Entry point
├── frontend/               # React application
│   ├── src/
│   │   ├── components/    # React components
│   │   └── services/      # API integration
│   └── public/
├── database/              # Database schema
├── docker-compose.yml     # Docker setup
└── README.md
```

## 🔧 API Endpoints

### Fund Operations
- `GET /api/funds` - Search mutual funds
- `GET /api/funds/:schemeCode/nav` - Get NAV data
- `POST /api/compare` - Compare fund performance

### Portfolio Management
- `POST /api/portfolio/create` - Create multi-fund portfolio
- `POST /api/portfolio/sip-calculator` - Multi-fund SIP calculation
- `GET /api/portfolio/:id/analysis` - Portfolio analysis

### System
- `GET /health` - Health check
- `GET /ready` - Readiness check

## 💡 Usage Examples

### Creating a Portfolio
```javascript
const portfolio = {
  name: "Balanced Growth Portfolio",
  funds: [
    { schemeCode: "120503", allocation: 40, name: "Large Cap Fund" },
    { schemeCode: "118989", allocation: 30, name: "Mid Cap Fund" },
    { schemeCode: "119551", allocation: 20, name: "Small Cap Fund" },
    { schemeCode: "122639", allocation: 10, name: "International Fund" }
  ],
  totalAmount: 100000,
  investmentType: "lumpsum"
};
```

### Multi-fund SIP Calculation
```javascript
const sipPlan = {
  monthlyAmount: 10000,
  duration: 60, // months
  funds: [
    { schemeCode: "120503", allocation: 50 },
    { schemeCode: "118989", allocation: 30 },
    { schemeCode: "119551", allocation: 20 }
  ]
};
```

## 🔍 Monitoring & Health

The application includes comprehensive monitoring:

- **Health Checks** - `/health` endpoint for service status
- **Performance Logging** - Request/response timing
- **Error Tracking** - Structured error logging
- **Cache Monitoring** - Cache hit/miss rates

## 🚀 Deployment

### Production Environment
1. Set `NODE_ENV=production`
2. Configure PostgreSQL (recommended for production)
3. Set up reverse proxy (nginx)
4. Configure SSL certificates
5. Set up monitoring and logging

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3001
ENABLE_DATABASE=true
DB_HOST=your-postgres-host
DB_NAME=mf_comparison_prod
# ... other production settings
```

## 🛡️ Security Features

- **Rate Limiting** - Prevent API abuse
- **CORS Protection** - Secure cross-origin requests
- **Helmet.js** - Security headers
- **Input Validation** - Joi schema validation
- **Error Handling** - No sensitive data leakage

## 🔧 Development

### Running Tests
```bash
cd backend && npm test
cd frontend && npm test
```

### Code Formatting
```bash
npm run lint
npm run format
```

### Database Migration (if using PostgreSQL)
```bash
cd database
psql -U username -d mf_comparison -f init.sql
```

## 📊 Performance Optimizations

- **In-memory Caching** - 30-minute cache for API responses
- **Database Caching** - Long-term storage for frequently accessed data
- **Request Optimization** - Minimized API calls with intelligent caching
- **Lazy Loading** - Components loaded on demand

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [MFApi.in](https://api.mfapi.in) for providing free mutual fund data
- [Recharts](https://recharts.org/) for beautiful charts
- [React](https://reactjs.org/) and [Node.js](https://nodejs.org/) communities

## 📞 Support

For support and queries:
- Create an issue on GitHub
- Check the health endpoint: `/health`
- Review logs for troubleshooting

---

**Made with ❤️ for Indian investors**

> ⚠️ **Disclaimer**: This tool is for informational purposes only. Please consult with financial advisors before making investment decisions.

---
