$env:DATABASE_URL = "postgresql://neondb_owner:npg_wDlqYznG3a1R@ep-long-dream-amha7c20-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$env:PORT = "8080"
pnpm --filter @workspace/api-server run dev  

$env:BASE_PATH = "/"
$env:PORT = "3000"
pnpm --filter @workspace/levy-platform run dev
