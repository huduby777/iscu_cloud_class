# Week 02 URL 입력값 검증

2주차에는 새 프로젝트를 만들지 않고, 1주차에 사용한 프로젝트에 이번 주 업데이트 파일을 덮어씁니다. 화면과 제출 처리 흐름은 미리 제공되며, 학생은 URL 입력값 검증 함수만 완성합니다.

## 선행 조건

- week01 실습을 완료한 프로젝트가 로컬에 준비되어 있어야 합니다.
- 프로젝트에서 `npm run dev`가 정상적으로 실행되어야 합니다.
- 작업 중인 내용이 있다면 파일을 복사하기 전에 commit합니다.

## 제공 파일

`week02/files`에는 이번 주에 교체할 파일만 들어 있습니다.

```text
files/
└─ app/
   ├─ page.js
   ├─ globals.css
   └─ layout.js
```

| 파일 | 역할 |
| --- | --- |
| `app/page.js` | URL 입력 화면, 상태 관리, 제출 처리, 학생 실습 TODO |
| `app/globals.css` | 입력 화면과 상태 메시지 스타일 |
| `app/layout.js` | 2주차 페이지 제목과 설명 |

이번 주에는 패키지를 추가하지 않으므로 `package.json`, `package-lock.json`, `.gitignore`는 교체하지 않습니다.

## 업데이트 파일 적용

`week02/files` 폴더 **안의 내용**을 1주차 프로젝트 루트에 복사합니다. `files` 폴더 자체를 프로젝트 안에 넣는 것이 아니라, 그 안의 `app` 폴더가 기존 `app` 폴더와 겹치도록 복사해야 합니다.

파일 덮어쓰기를 묻는 메시지가 나오면 허용합니다. 적용 후 프로젝트 구조는 다음과 같습니다.

```text
내 프로젝트/
├─ app/
│  ├─ globals.css
│  ├─ layout.js
│  └─ page.js
├─ package.json
└─ package-lock.json
```

프로젝트 루트에서 변경된 파일을 확인합니다.

```bash
git status
git diff
```

## 학생이 구현할 부분

`app/page.js`에서 아래 함수의 TODO를 완성합니다.

```js
function validateUrl(value) {
  const trimmedUrl = value.trim();

  // TODO 1: 빈 값 검증
  // TODO 2: 최대 길이 검증
  // TODO 3: http:// 또는 https:// 시작 여부 검증
  // TODO 4: 올바른 URL 형식 검증

  return null;
}
```

반환 규칙은 다음과 같습니다.

| 입력 상태 | 반환값 |
| --- | --- |
| 잘못된 입력 | 조건에 맞는 오류 메시지 |
| 올바른 입력 | `null` |

검증 조건과 오류 메시지는 위에서부터 다음 순서로 작성합니다.

1. 공백을 제거한 값이 비어 있으면 `URL을 입력해 주세요.`
2. 길이가 `MAX_URL_LENGTH`보다 길면 `URL은 2048자 이하로 입력해 주세요.`
3. `http://`와 `https://` 중 어느 것으로도 시작하지 않으면 `URL은 http:// 또는 https://로 시작해야 합니다.`
4. 정상적인 URL 형식이 아닌 경우 (e.g. http://abcde) `올바른 URL 형식으로 입력해 주세요`
5. 모든 조건을 통과하면 기존의 `return null` 실행

## 미리 제공된 코드

- URL 입력창과 Shorten 버튼
- `useState`를 이용한 입력값·오류·결과·로딩 상태
- `onChange`, `onSubmit`, `event.preventDefault()`
- 오류·결과·로딩 영역의 조건부 표시
- 0.8초 임시 로딩 처리
- 반응형 CSS

제출 흐름은 다음과 같습니다.

```text
Shorten 버튼 클릭
→ handleSubmit 실행
→ validateUrl 호출
→ 오류가 있으면 오류 메시지 표시
→ 오류가 없으면 처리 중 상태 표시
→ 검증 완료 결과 표시
```

## 실행 및 테스트

week01에서 이미 `npm install`을 완료했다면 다시 설치할 필요 없이 실행할 수 있습니다.

```bash
npm run dev
```

처음 내려받은 환경이거나 `node_modules`가 없다면 먼저 `npm install`을 실행합니다.

| 입력값 | 기대 결과 |
| --- | --- |
| 빈 문자열 또는 공백 | 빈 값 오류 |
| 2048자를 초과하는 문자열 | 최대 길이 오류 |
| `www.google.com` | 시작 형식 오류 |
| `ftp://example.com` | 시작 형식 오류 |
| `http://www.google.com` | 검증 완료 |
| `https://www.google.com` | 검증 완료 |

2049자 URL은 브라우저 개발자 도구 Console에서 다음과 같이 만들 수 있습니다.

```js
const longUrl = "https://example.com/?q=" + "a".repeat(2026);
copy(longUrl);
```

제출 전에 프로덕션 빌드도 확인합니다.

```bash
npm run build
```

## commit, push, 자동 배포

```bash
git add app/page.js app/globals.css app/layout.js
git commit -m "Complete week 02 URL validation"
git push
```

GitHub에 push하면 기존에 연결한 Vercel 프로젝트에서 자동 빌드와 배포가 시작됩니다. 배포 URL에서 변경된 화면과 입력값 검증 결과를 확인합니다.

```text
로컬 파일 업데이트
→ 입력값 검증 함수 완성
→ commit
→ GitHub push
→ Vercel 자동 빌드
→ 클라우드에 새 버전 배포
```
