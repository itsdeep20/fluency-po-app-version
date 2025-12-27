# Deployment Guide: Fluency AI Pro

This guide lists the exact steps to take your application from your local workspace to a live URL on the internet.

## Prerequisites

- [ ] **Google Cloud Project**: You need a project created in the [Google Cloud Console](https://console.cloud.google.com/).
- [ ] **Billing Enable**: Verify billing is enabled (to use your $300 credit).
- [ ] **APIs Enabled**: You will need to enable:
    - `Cloud Functions API`
    - `Cloud Run API`
    - `Vertex AI API`
    - `Cloud Build API`
    - `Artifact Registry API`

## Phase 1: Backend Deployment (The "Brain")

This deploys the Python code to Google Cloud Functions.

1.  **Open Terminal** in your workspace or use Cloud Shell in the browser.
2.  **Login & Set Project**:
    ```bash
    gcloud auth login
    gcloud config set project [YOUR_PROJECT_ID]
    ```
3.  **Deploy Command**:
    ```bash
    gcloud functions deploy fluency-backend \
    --gen2 \
    --runtime=python310 \
    --region=us-central1 \
    --source=./backend \
    --entry-point=fluency_backend \
    --trigger-http \
    --allow-unauthenticated
    ```
4.  **Save the URL**: The command will output a URL (e.g., `https://us-central1-....cloudfunctions.net/fluency-backend`). **Copy this URL.**

## Phase 2: Frontend Configuration (The "Face")

Now we connect the React app to your new backend URL.

1.  **Update Environment File**:
    - Open (or create) `.env` in the root folder.
    - Add your backend URL:
      ```
      VITE_BACKEND_URL=https://[YOUR_COPIED_URL]
      ```
2.  **Update Firebase Config**:
    - Add your Firebase keys to `.env` (API Key, Auth Domain, etc. from your Firebase Console).

## Phase 3: Frontend Deployment

This builds and uploads the website to Firebase Hosting.

1.  **Initialize Firebase**:
    ```bash
    firebase login
    firebase init
    ```
    - Select **Hosting**.
    - Select **Use an existing project** (choose your project).
    - What do you want to use as your public directory? `dist`
    - Configure as a single-page app? `Yes`
    - Set up automatic builds and deploys with GitHub? `No` (for now)
2.  **Build & Deploy**:
    ```bash
    npm run build
    firebase deploy
    ```

## Phase 4: Final verification

1.  Open the **Hosting URL** provided by Firebase.
2.  Log in with Google.
3.  Start a chat to verify the AI connects to the backend!
