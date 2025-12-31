---
description: Project rules and important decisions to always remember
---

# Fluency Pro - Project Rules & Important Decisions

These are important project decisions that should ALWAYS be followed.

## Cloud Function Deployment

1. **Memory**: Always use **1GB (1024MB)** memory for the Cloud Function
   - Command: `--memory=1024MB` or `--memory=1GB`
   - Reason: AI/Gemini processing requires more memory for optimal performance

2. **Deployment Command**:
   ```bash
   gcloud functions deploy fluency_backend --gen2 --runtime=python311 --region=us-central1 --source=backend --entry-point=fluency_backend --trigger-http --allow-unauthenticated --project=project-fluency-ai-pro-d3189 --memory=1GB
   ```

3. **Note**: Firebase deploy does NOT work for Python functions. Always use `gcloud functions deploy`.

## Environment Variables

- Backend URL: `VITE_BACKEND_URL=https://us-central1-project-fluency-ai-pro-d3189.cloudfunctions.net/fluency_backend`
- Project ID: `project-fluency-ai-pro-d3189`

## Important Architecture Notes

1. **Battle-Bot vs Simulation**:
   - Simulations use `type: 'bot'` and `backend type: 'chat'`
   - Battle-Bots use `type: 'battle-bot'` and `backend type: 'send_message'`

2. **Bot Room Required Fields** (for `create_bot_room`):
   - `isBotMatch: True`
   - `player2Id`, `player2Name`, `player2Avatar`
   - `botPersona` (the full bot object)

3. **Warmup Handler**: Backend must handle `type: 'warmup'` for cold start mitigation
