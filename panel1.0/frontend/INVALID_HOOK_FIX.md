# Invalid Hook Call 오류 해결 가이드

## 🔍 Root Cause 분석

### 문제 원인
1. **Zustand Store 사용 방식**: 전체 state를 destructure하는 방식이 React의 훅 규칙과 충돌할 수 있음
2. **React 중복 설치 가능성**: node_modules에 여러 버전의 React가 설치되어 있을 수 있음
3. **unplugin-auto-import 충돌**: 자동 import가 React 훅 해석에 문제를 일으킬 수 있음

## ✅ 적용된 수정 사항

### 1. Zustand Store 개선 (`targetGroupStore.ts`)
- **변경 전**: 전체 state를 한 번에 destructure
  ```typescript
  const { groups, stats, ... } = useTargetGroupStore();
  ```
  
- **변경 후**: 선택자 함수를 사용하여 필요한 값만 가져오기
  ```typescript
  const groups = useTargetGroupStore((state) => state.groups);
  const stats = useTargetGroupStore((state) => state.stats);
  ```
  
**이유**: 선택자 함수를 사용하면 Zustand가 React의 훅 시스템과 더 잘 통합됩니다.

### 2. useTargetGroup 훅 개선 (`useTargetGroup.ts`)
- 명시적으로 `useCallback`을 React에서 import
- 각 store 값에 대해 개별 선택자 함수 사용
- 훅 호출 규칙 준수 확인 주석 추가

### 3. TargetGroupPage 컴포넌트 개선 (`page.tsx`)
- 함수 선언 방식으로 변경 (`const` → `export default function`)
- 훅 호출 위치 명확화 (컴포넌트 최상위)
- 주석으로 훅 규칙 설명 추가

### 4. Vite 설정 개선 (`vite.config.js`)
- React 중복 설치 방지를 위한 alias 추가
- `dedupe` 옵션으로 React 중복 제거

## 📋 React 훅 규칙 검증

### ✅ 올바른 훅 사용
```typescript
export default function TargetGroupPage() {
  // ✅ 컴포넌트 최상위에서 훅 호출
  const { groups } = useTargetGroup();
  const [state, setState] = useState();
  
  // ✅ 조건문 안에서 훅 호출 안 함
  // ✅ 반복문 안에서 훅 호출 안 함
  // ✅ 중첩 함수 안에서 훅 호출 안 함
  
  return <div>...</div>;
}
```

### ❌ 잘못된 훅 사용 (제거됨)
```typescript
// ❌ 컴포넌트 외부에서 훅 호출
const data = useTargetGroup(); // 파일 상단

// ❌ 조건부 훅 호출
if (condition) {
  const data = useTargetGroup(); // ❌
}

// ❌ try-catch 안에서 훅 호출
try {
  const data = useTargetGroup(); // ❌
} catch {}
```

## 🧪 테스트 방법

1. **개발 서버 재시작**
   ```bash
   cd panel1.0/frontend
   npm run dev
   ```

2. **브라우저 콘솔 확인**
   - F12 → Console 탭
   - "Invalid Hook Call" 오류가 사라졌는지 확인

3. **타겟 그룹 페이지 접근**
   - `/target-groups` 경로로 이동
   - 페이지가 정상적으로 로드되는지 확인

## 🔧 추가 권장 사항

### React 중복 설치 확인
```bash
cd panel1.0/frontend
npm ls react react-dom
```

만약 여러 버전이 보이면:
```bash
npm dedupe
# 또는
rm -rf node_modules package-lock.json
npm install
```

### Zustand 버전 확인
Zustand 5.0.8은 React 19와 호환됩니다. 문제가 계속되면:
```bash
npm install zustand@latest
```

## 📝 참고 자료
- [React Hooks 규칙](https://react.dev/reference/rules/rules-of-hooks)
- [Zustand 공식 문서](https://zustand.docs.vercel.app/)
- [Vite resolve 설정](https://vitejs.dev/config/shared-options.html#resolve-dedupe)

