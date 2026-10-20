import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 개발 서버에서 /api 요청을 백엔드(게이트웨이)로 프록시한다.
  // 운영에서는 nginx가 동일한 역할을 하므로, 앱 코드는 항상 같은 오리진('/api')만 바라본다.
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080'

  return {
    // 기획자 원본은 Next.js + Tailwind v4(@tailwindcss/postcss)로 개발된다. 화면 코드는 Tailwind 클래스를 쓰지 않고
    // 인라인 스타일뿐이지만, globals.css의 `@import "tailwindcss"`가 깔아주는 기본 리셋(preflight)을 전제로 디자인됐다 —
    // 버튼 배경 투명·글꼴 상속·제목/문단 여백 0. 이 플러그인이 없으면 그 줄이 무시되고 브라우저 기본값이 새어 나온다
    // (UV-62: 포털 좌측 메뉴의 안 고른 항목에 버튼 기본 회색 #EFEFEF가 깔림). 버전은 기획자 lock과 같게 고정.
    plugins: [react(), tailwindcss()],
    // 기획자 원본 코드(Next.js 관용구 process.env.NEXT_PUBLIC_*)를 수정 없이 반입하기 위한 치환.
    // Vite에는 process가 없어 빌드 타임에 문자열로 대체된다 — lib/api/client.ts가 사용.
    define: {
      'process.env.NEXT_PUBLIC_API_BASE_URL': JSON.stringify(env.NEXT_PUBLIC_API_BASE_URL ?? ''),
    },
    // 기획자 원본 코드를 수정 없이 반입하기 위한 별칭 — tsconfig.app.json paths와 세트
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src/features/vca', import.meta.url)),
        'next/navigation': fileURLToPath(new URL('./src/features/vca/compat/navigation.ts', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
        // /streams → 미디어 서버(MediaMTX WebRTC/WHEP). 운영에서는 nginx가 동일 역할 (UV-43)
        '/streams': {
          target: env.VITE_MEDIA_PROXY_TARGET || 'http://localhost:8889',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/streams/, ''),
        },
      },
    },
  }
})
