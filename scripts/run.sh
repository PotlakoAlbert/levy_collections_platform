$env:DATABASE_URL = "postgresql://neondb_owner:npg_wDlqYznG3a1R@ep-long-dream-amha7c20-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$env:PORT = "8080"
$env:REDIS_URL = "redis-cli --tls -u redis://default:gQAAAAAAAQhaAAIgcDE0ODNmMTQ5MDJmZjY0YWQwYTQwNGZjMmZmNDY1NDg3YQ@witty-quetzal-67674.upstash.io:6379"
pnpm --filter @workspace/api-server run dev
# Redis URL - REQUIRED! Set to your Upstash URL or local Redis
# For Upstash: $env:REDIS_URL = "redis://default:password@host:port"

#$env:REDIS_URL = "redis://localhost:6379"
  

$env:BASE_PATH = "/"
$env:PORT = "3000"
pnpm --filter @workspace/levy-platform run dev
