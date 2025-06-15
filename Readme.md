# Peptide Suggestions App

A full-stack web application that provides personalized peptide recommendations based on user health goals and age. The application features a React frontend with authentication, a Node.js/Express backend with comprehensive validation, and built-in analytics.

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

### Setup Instructions

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd peptide-suggestions-app
   ```

2. **Backend Setup**

   ```bash
   cd backend
   npm install
   npm run dev
   ```

   The backend server will start on `http://localhost:3001`

3. **Frontend Setup** (in a new terminal)

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   The frontend application will start on `http://localhost:3000`

## 📋 Project Structure

```
peptide-suggestions-app/
├── backend/                 # Node.js/Express API server
│   ├── src/
│   │   ├── middleware/      # Validation and auth middleware
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic services
│   │   ├── utils/          # Logging and utilities
│   │   └── server.js       # Main server file
│   ├── logs/               # Application and analytics logs
│   └── package.json
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React context providers
│   │   └── App.js         # Main App component
│   └── package.json
└── README.md
```

## 🔧 Core Features

### User Interface

- **Interactive Form**: Age input and health goal selection (energy, sleep, focus, recovery, longevity, weight management, immune support)
- **Authentication System**: Optional user registration and login
- **Responsive Design**: Mobile-friendly interface built with Tailwind CSS
- **Real-time Validation**: Client-side and server-side input validation

### Backend Services

- **Suggestions Engine**: Personalized peptide recommendations based on age and health goals
- **User Management**: Authentication with JWT tokens
- **Analytics Tracking**: Request logging and user behavior analytics
- **Rate Limiting**: Protection against API abuse
- **Comprehensive Logging**: Structured logging with Winston
- **Database**: SQLite was used for storing user data

### Data Validation

- **Input Sanitization**: Joi schema validation for all endpoints
- **Age Constraints**: Validates age between 18-120 years
- **Goal Validation**: Ensures valid health goal selection
- **Request Rate Limiting**: Protects against excessive API calls

## 🛡️ Edge Case Handling

The application includes robust handling for various edge cases:

### Age-Related Validations

- **Minimum Age**: Users under 18 are blocked with appropriate messaging
- **Maximum Age**: Users above 120 are blocked with appropriate messaging

### Input Validation Edge Cases

- **Non-numeric Age**: Converts strings to numbers, rejects invalid inputs
- **Out-of-Range Values**: Handles negative ages, excessively high ages
- **Invalid Goal Selection**: Validates against predefined health goals list
- **Empty/Missing Fields**: Comprehensive required field validation
- **SQL Injection Prevention**: All inputs are sanitized and validated

### User Experience Edge Cases

- **Loading States**: Prevents multiple simultaneous submissions
- **Error Handling**: Clear error messages with suggested actions
- **Session Management**: Automatic token verification and renewal

## 📊 API Endpoints

### Core Endpoints

- `POST /suggestions` - Get peptide recommendations
- `POST /auth/register` - User registration
- `POST /auth/login` - User authentication
- `GET /auth/verify` - Token verification
- `GET /analytics` - Usage analytics (admin)
- `GET /health` - System health check

## 📈 Analytics and Logging

### Application Logging

- **Structured Logging**: JSON format with Winston
- **Log Rotation**: Daily log files with automatic cleanup
- **Error Tracking**: Detailed error context and stack traces

### Analytics Features

- **Usage Tracking**: Request counts and goal selections
- **Error Monitoring**: Failed request tracking and analysis
- **System Metrics**: Server health and performance data

## 🚀 Production Considerations

### Enhanced Validation for Production

If this were a production application, the following enhancements would be implemented:

#### 1. **Caching**

- **Caching for Performance Optimization**: Use of Memcached or Redis for Caching

#### 2. **API Security Enhancements**

- **OAuth 2.0 Integration**: Enterprise authentication providers

#### 3. **Monitoring and Alerting**

- **Logging and Analytics Infrastructure**: Use of proper logging and analytics infrastructure like ELK Stack (Elasticsearch, Logstash, Kibana) or Graylog

#### 4. **Database Server**

- **Use of a proper SQL Database**: For production we would use a proper database server eg MySql, Microsoft SQL etc for enhanced database performance and security
