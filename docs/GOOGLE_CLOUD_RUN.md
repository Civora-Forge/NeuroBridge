# Cloud Run Deployment

This deploys the FastAPI API only. The browser frontend remains a separate Vite deployment and must be configured with the resulting Cloud Run URL. Do not use SQLite on Cloud Run: its filesystem is ephemeral. Supply a persistent Postgres `DATABASE_URL` and apply the repository's Supabase migrations before serving users.

## Prerequisites

- A Google Cloud project with billing, Cloud Run, Cloud Build, Artifact Registry, and Secret Manager enabled.
- A Supabase project with the required migrations applied.
- A Gemini API key stored only in Secret Manager.
- A browser origin for the deployed frontend.

## Deploy

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
printf '%s' 'YOUR_GEMINI_API_KEY' | gcloud secrets create neurobridge-gemini-api-key --data-file=-
printf '%s' 'YOUR_POSTGRES_CONNECTION_STRING' | gcloud secrets create neurobridge-database-url --data-file=-
gcloud run deploy neurobridge-api \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=neurobridge-gemini-api-key:latest,DATABASE_URL=neurobridge-database-url:latest \
  --set-env-vars SUPABASE_URL=https://YOUR_PROJECT.supabase.co,SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY,CORS_ALLOWED_ORIGINS=https://YOUR_FRONTEND_DOMAIN
```

Cloud Run injects `PORT`; the root `Dockerfile` starts Uvicorn on that port. Verify the deployment without exposing credentials:

```bash
curl "$(gcloud run services describe neurobridge-api --region asia-south1 --format='value(status.url)')/healthz"
```

Set `VITE_API_BASE_URL` to the returned service URL in the frontend host, rebuild/redeploy the frontend, then verify authenticated API and Gemini opt-in behavior. Restrict Cloud Run ingress/authentication before production if a same-origin gateway is introduced; browser access currently requires the API to accept authenticated frontend requests.
