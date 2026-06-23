# Full Stack Deployment Instructions

## Architecture
- **Backend**: Python FastAPI deployed on Render
- **Frontend**: Next.js deployed on Vercel
- **Database**: Mock data (can be replaced with real database later)

## Part 1: Deploy Backend to Render

### Prerequisites
- Render account (free tier works)
- GitHub repository with the code

### Steps

1. **Push Backend Code to GitHub**
   ```bash
   git add .
   git commit -m "Add Render backend deployment configuration"
   git push origin main
   ```

2. **Create Render Service**
   - Go to [render.com](https://render.com) and sign in
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `TanishqArora01/Decision-Intelligent-System`
   - Configure:
     - **Root Directory**: `fraud-detection hardened/app-backend`
     - **Runtime**: Python 3
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
     - **Instance Type**: Free
   - Click "Create Web Service"

3. **Get Backend URL**
   - Once deployed, Render will provide a URL like:
     `https://decision-intelligence-api.onrender.com`
   - Copy this URL for the Vercel deployment

## Part 2: Deploy Frontend to Vercel

### Prerequisites
- Vercel account (free tier works)
- Backend URL from Render deployment

### Steps

1. **Update Environment Variable**
   - Edit `fraud-detection hardened/frontend/vercel.json`
   - Replace the `NEXT_PUBLIC_API_URL` value with your Render backend URL
   - Example: `"NEXT_PUBLIC_API_URL": "https://decision-intelligence-api.onrender.com"`

2. **Push Updated Frontend**
   ```bash
   git add .
   git commit -m "Update frontend to use Render backend"
   git push origin main
   ```

3. **Import Project to Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "Add New Project" → "Import"
   - Select your GitHub repository: `TanishqArora01/Decision-Intelligent-System`
   - Configure:
     - **Framework Preset**: Next.js
     - **Root Directory**: `fraud-detection hardened/frontend`
     - **Build Command**: `npm run build` (auto-detected)
     - **Output Directory**: `.next` (auto-detected)
     - **Install Command**: `npm install` (auto-detected)

4. **Add Environment Variable**
   - In Vercel Project Settings → Environment Variables
   - Add:
     - **Name**: `NEXT_PUBLIC_API_URL`
     - **Value**: Your Render backend URL (e.g., `https://decision-intelligence-api.onrender.com`)
     - **Environment**: Production, Preview, Development

5. **Deploy**
   - Click "Deploy" and wait for the build to complete (~2-3 minutes)

6. **Access Your Deployment**
   - Vercel will provide a URL like:
     `https://decision-intelligent-system-xyz.vercel.app`

## Demo Credentials for Testing

When you access the deployed application, use these demo credentials on the login page:

- **Admin**: username: `admin`, password: `admin2024!`
- **Analyst**: username: `analyst1`, password: `analyst2024!`
- **Ops Manager**: username: `ops1`, password: `ops2024!`
- **Bank Partner**: username: `partner1`, password: `partner2024!`

## What's Deployed

### Backend (Render - Python FastAPI)
- RESTful API with endpoints for analytics, transactions
- Mock data generation for demonstration
- CORS enabled for cross-origin requests
- Health check endpoint

### Frontend (Vercel - Next.js)
- Complete Next.js 14 application with TypeScript
- Real-time dashboard with analytics from backend
- Authentication system with demo accounts
- Responsive design with Tailwind CSS

## Troubleshooting

### Backend Issues (Render)
- Check Render dashboard for build logs
- Verify Python version compatibility
- Ensure all dependencies are in requirements.txt
- Check that the service is running (green status)

### Frontend Issues (Vercel)
- Ensure Node.js version is 18 or higher
- Verify the backend URL is correct in environment variables
- Check Vercel build logs for errors
- Test backend URL directly in browser

### API Connection Issues
- Verify backend is accessible from browser
- Check CORS configuration on backend
- Ensure environment variable is set correctly in Vercel
- Check browser console for network errors

### Authentication Issues
- Use the demo credentials shown on the login page
- Clear browser cookies and localStorage if needed
- Check browser console for error messages
- Verify backend auth endpoints are working

## Future Enhancement

To add real database and features:
1. Add PostgreSQL database to Render
2. Update backend to use real database instead of mock data
3. Implement proper JWT authentication
4. Add more ML models for fraud detection
5. Connect real transaction data sources

## Monitoring

### Render (Backend)
- Real-time logs in Render dashboard
- Metrics: CPU, memory, response time
- Error tracking and alerts

### Vercel (Frontend)
- Real-time logs in Vercel dashboard
- Analytics: page views, visitors
- Performance metrics
- Error tracking
