# Environment Variables

## Market Intelligence

All live Market configuration is parsed by `getMarketIntelligenceConfig()`. Provider secrets are read only in server execution and are never returned by workspace responses, health diagnostics, logs, or analytics.

| Variable | Required | Default | Bounds / purpose |
| --- | --- | --- | --- |
| `MARKET_PROVIDER_ENABLED` | No | `true` | Set `false` to disable live Market analysis safely. |
| `RENTCAST_API_KEY` | When enabled | none | Server-only provider credential. |
| `RENTCAST_BASE_URL` | No | `https://api.rentcast.io/v1` | HTTPS provider base URL. |
| `RENTCAST_REQUEST_TIMEOUT_MS` | No | `10000` | 1,000–30,000 milliseconds per provider request. |
| `MARKET_PROVIDER_RETRY_COUNT` | No | `1` | 0–2 retries for timeout, network, and availability failures only. |
| `MARKET_ANALYSIS_CACHE_TTL_SECONDS` | No | `300` | 30–3,600 seconds for process-local provider-result caching. |
| `MARKET_ANALYSIS_RATE_LIMIT_PER_MINUTE` | No | `6` | 1–60 workspace submissions per authenticated actor per process. |

Invalid or missing enabled-provider configuration returns a safe unavailable state and marks operational health misconfigured. Preview and production must configure values independently in Vercel. Never place `RENTCAST_API_KEY` in a `NEXT_PUBLIC_` variable.
