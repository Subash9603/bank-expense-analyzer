# Production Deployment Guide: AI Day-to-Day Expense Analyzer

This guide details how to host your separated application live on the web so it is accessible from any mobile or desktop device globally, even when your local computer is turned off.

---

## Part 1: Deploying the Backend API (Render / Railway / AWS)

Your backend is a Flask API server. Render.com is recommended because it is free and supports Python and PostgreSQL.

### Step 1: Create a Render Account
1. Sign up on **[Render.com](https://render.com/)**.
2. Connect your GitHub repository containing this codebase.

### Step 2: Deploy Web Service
1. Click **New +** and select **Web Service**.
2. Select your repository.
3. Configure the settings:
   - **Name**: `ai-bank-analyzer-api`
   - **Runtime**: `Python`
   - **Build Command**: `pip install -r requirements.txt` (or backend/requirements.txt if separated)
   - **Start Command**: `gunicorn app:app` (Make sure `gunicorn` is installed. It is already added to your requirements list!)
   - **Instance Type**: `Free`

### Step 3: Configure Environment Variables
Under the **Environment** tab on Render, add the following variables:
- `FLASK_ENV` = `production`
- `FLASK_SECRET_KEY` = *(A secure random string)*
- `DATABASE_URL` = *(Your PostgreSQL Database connection URL - Render creates this automatically if you link a database)*
- `CORS_ORIGINS` = `https://your-custom-site-name.netlify.app` *(Your final live Netlify URL)*

---

## Part 2: Deploying the Database (PostgreSQL)

1. On Render, click **New +** and select **PostgreSQL**.
2. Choose a name and click **Create Database**.
3. Once active, copy the **Internal Database URL** (or External URL).
4. Paste this URL into your Backend Web Service environment variables as `DATABASE_URL`.
5. The Flask app will automatically detect this connection on launch, run `db.create_all()`, and set up all table structures in PostgreSQL without losing your code.

---

## Part 3: Deploying the Frontend (Netlify)

Once the backend is live, verify it by calling its `/api/health` URL.

1. Open [`frontend/js/auth.js`](frontend/js/auth.js) on your computer.
2. Replace the default placeholder Render URL in `API_BASE_URL` with your newly generated backend API URL:
   ```javascript
   const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
       ? 'http://127.0.0.1:5000' 
       : 'https://ai-bank-analyzer-api.onrender.com'; // Replace with your actual Live Backend URL
   ```
3. Drag and drop the **contents** of your `frontend/` folder into Netlify Drop once more to update the live app.
