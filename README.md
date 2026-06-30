# VRM / VRMA Side Panel Extension

브라우저 오른쪽 사이드패널에서 VRM 모델과 VRMA 애니메이션을 불러와 확인하는 확장 프로그램입니다.

## 기능

- VRM 모델 로딩
- VRMA 애니메이션 로딩 및 재생 / 일시정지 / 반복
- VRM 기본 MToon 머티리얼 로딩
- 조명 세기와 X/Y/Z 위치 조절
- 카메라 위아래 이동, 줌인/줌아웃, 상하 회전 조절
- 조명 및 카메라 설정 자동 저장
- Neutral, Happy, Angry, Sad, Relaxed, Surprised 표정 버튼

## 빌드

```powershell
npm install
npm run build
```

## 브라우저에 설치

1. Chromium 계열 브라우저에서 `chrome://extensions`를 엽니다.
2. 개발자 모드를 켭니다.
3. “압축해제된 확장 프로그램을 로드”를 누릅니다.
4. 이 프로젝트의 `dist` 폴더를 선택합니다.
5. 툴바의 확장 아이콘을 누르면 오른쪽 사이드패널이 열립니다.

## 개발 실행

```powershell
npm run dev
```

개발 서버 화면은 확장 설치 전 UI 확인용입니다. 실제 사이드패널 확장 테스트는 `npm run build` 후 `dist` 폴더를 로드하세요.
