// Vercel 정적 배포용: server/public 을 dist 로 복사한다 (빌드 도구 없음)
import { cpSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
cpSync('server/public', 'dist', { recursive: true });
console.log('dist ready');
