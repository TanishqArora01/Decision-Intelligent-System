# Vercel Deployment Instructions

## Prerequisites
- Vercel account (free tier works)
- GitHub repository with the code
- Node.js 18+ installed locally

## Deployment Steps

### 1. Push Code to GitHub
Ensure your changes are pushed to the GitHub repository:
```bash
git add .
git commit -m "Configure for Vercel deployment with mock API"
git push origin main
```

### 2. Import Project to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project" → "Import"
3. Select your GitHub repository: `TanishqArora01/Decision-Intelligent-System`
4. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `fraud-detection hardened/frontend`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

### 3. Environment Variables
Add these environment variables in Vercel Project Settings:
- `NEXT_PUBLIC_API_URL`: `/api` (this tells the frontend to use the mock API endpoints)

### 4. Deploy
Click "Deploy" and wait for the build to complete (~2-3 minutes).

### 5. Verify Deployment
Once deployed, Vercel will provide a URL like:
`https://decision-intelligent-system-xyz.vercel.app`

Visit the URL and test:
- Navigate to `/login` 
- Use demo credentials (e.g., username: `admin`, password: `admin2024!`)
- Verify dashboard loads with mock analytics data

## What's Deployed

### Frontend (Next.js)
- Complete Next.js 14 application with TypeScript
- Real-time dashboard with mock analytics
- Authentication system with demo accounts
- Responsive design with Tailwind CSS

### Mock Backend API (Vercel Serverless Functions)
- `/api/transactions` - Mock transaction data
- `/api/analytics` - Mock analytics data (overview, fraud rate, actions, top risk)
- `/api/health` - Health check endpoint

## Architecture Notes

The Python backend microservices are not yet implemented, so we've created mock API endpoints that:
- Return realistic data matching the frontend's expected structure
- Support all dashboard analytics features
- Provide a fully functional demo deployment

## Future Enhancement

To replace the mock API with the actual Python backend:
1. Deploy Python backend to a container platform (Render, Railway, AWS ECS)
2. Update `NEXT_PUBLIC_API_URL` environment variable to point to the real backend
3. Remove the mock API endpoints from the Vercel project
4. Implement proper authentication between frontend and backend

## Troubleshooting

### Build Fails
- Ensure Node.js version is 18 or higher
- Check that all dependencies are installed
- Verify the root directory is set correctly

### API Errors
- Verify `NEXT_PUBLIC_API_URL` is set to `/api`
- Check that the API endpoints are working by visiting `/api/health`
- Ensure CORS headers are properly configured

### Authentication Issues
- Use the demo credentials shown on the login page
- Clear browser cookies and localStorage if needed
- Check browser console for error messages

## Custom Domain (Optional)

To use a custom domain:
1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed by Vercel
4. Wait for SSL certificate provisioning

## Monitoring

Vercel provides built-in monitoring:
- Real-time logs
- Analytics (page views, visitors)
- Performance metrics
- Error tracking

Access these from the Vercel dashboard.
