# Cloudflare Workers AI setup

This project can call Cloudflare Workers AI through the REST API without changing the existing Next.js runtime.

## Supported provider switch

Set `AI_PROVIDER=cloudflare` in your local `.env.local`.

Required variables:

```env
AI_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-workers-ai-token
CLOUDFLARE_MODEL=@cf/meta/llama-3.2-11b-vision-instruct
```

## One-time model agreement

Meta-hosted vision models require a one-time license acceptance.

```bash
npm run cf:agree
```

If you switch `CLOUDFLARE_MODEL` to a non-Meta model, the script exits without doing anything.

## Local test flow

1. Copy `.env.example` to `.env.local`.
2. Fill in the Cloudflare values above.
3. Run `npm run cf:agree` once if you keep the default Meta model.
4. Start the app with `npm run dev`.
5. Upload one test image through the existing UI or call `POST /api/analyze`.

## Notes

- The Cloudflare integration currently uses the REST API from the Next.js server route, not a deployed Worker binding.
- The request sends the existing project prompt plus the uploaded image to the selected Workers AI model.
- Cloudflare uses a provider-specific `FIELD|||VALUE` line protocol because the default vision model does not reliably satisfy JSON mode for every image.
- Each model request has a 25-second timeout. Line output is parsed field by field and retried once at most when too few usable fields are returned.
- File names, confidence values, and tag punctuation are normalized locally before entering the shared result path.
- The response is normalized through the same result path already used for Gemini and ModelScope.
- The Web UI preserves the selected file after a failed analysis and offers a `重新分析` action.
