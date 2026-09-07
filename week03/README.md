# Week 03 Backend API와 HTTP Status Code

3주차에는 2주차까지 만든 URL 입력 화면을 실제 Backend API와 연결합니다.

새로운 `page.js`를 제공하지 않습니다. 지난주에 완성한 `app/page.js`를 그대로 사용하면서, 임시로 작성되어 있던 처리 코드를 직접 수정하여 `/api/shorten` API를 호출하도록 변경합니다.

이번 주에는 다음 두 가지를 구현합니다.

1. `app/api/shorten/route.js`의 HTTP status code 완성
2. 기존 `app/page.js`의 `handleSubmit()`을 수정하여 Backend API 호출

---

## 선행 조건

- week02 실습을 완료한 프로젝트가 로컬에 준비되어 있어야 합니다.
- `app/page.js`의 `validateUrl()` 함수가 완성되어 있어야 합니다.
- 프로젝트에서 `npm run dev`가 정상적으로 실행되어야 합니다.
- 작업 중인 내용이 있다면 파일을 추가하거나 수정하기 전에 commit합니다.

---

## 이번 주 프로젝트 구조

이번 주에는 Backend API를 처리하는 Route Handler가 새로 추가됩니다.

```text
내 프로젝트/
├─ app/
│  ├─ api/
│  │  └─ shorten/
│  │     └─ route.js
│  ├─ globals.css
│  ├─ layout.js
│  └─ page.js
├─ package.json
└─ package-lock.json
```

| 파일 | 역할 |
| --- | --- |
| `app/api/shorten/route.js` | `POST /api/shorten` 요청을 처리하는 Backend API |
| `app/page.js` | 기존 URL 입력 화면에서 Backend API 호출 |
| `app/globals.css` | 기존 화면 스타일 |
| `app/layout.js` | 기존 페이지 설정 |

이번 주에는 `page.js` 전체를 새 파일로 교체하지 않습니다.

---

## 1. Backend API 파일 추가

제공된 다음 파일을 프로젝트에 추가합니다.

```text
app/api/shorten/route.js
```

Next.js App Router에서는 `route.js` 파일에 `GET`, `POST`와 같은 함수를 작성하여 HTTP 요청을 처리할 수 있습니다.

이번 실습의 API 주소는 다음과 같습니다.

```text
POST /api/shorten
```

클라이언트는 다음과 같은 JSON을 서버로 보냅니다.

```json
{
  "originalUrl": "https://www.google.com"
}
```

서버가 URL을 정상적으로 처리하면 다음과 같은 JSON을 반환합니다.

```json
{
  "shortCode": "XEZ9AE",
  "shortUrl": "http://localhost:3000/XEZ9AE",
  "originalUrl": "https://www.google.com"
}
```

---

## 2. `route.js` 코드 흐름 확인

`app/api/shorten/route.js`의 주요 처리 흐름은 다음과 같습니다.

```text
POST 요청 수신
→ request body의 JSON 읽기
→ originalUrl 확인
→ URL 길이 확인
→ URL 형식 확인
→ shortCode 생성
→ JSON 응답 반환
```

### `createShortCode()`

```js
function createShortCode(originalUrl, length = 6) {
  // ...
}
```

원본 URL을 이용해 6자리 short code를 생성하는 함수입니다.

이번 주에는 이 함수의 내부 알고리즘을 수정하지 않습니다.

### `POST()`

```js
export async function POST(request) {
  // ...
}
```

클라이언트가 `POST /api/shorten`으로 보낸 요청을 처리합니다.

요청에서 URL을 읽고, 입력값을 검사한 뒤, 성공 또는 오류 결과를 JSON으로 반환합니다.

---

## 3. HTTP Status Code 완성

제공된 `route.js`에서는 HTTP status code가 모두 임시 값인 `200`로 작성되어 있습니다.

```js
{ status: 200 }
```

각 상황을 확인하고 `200`를 적절한 HTTP status code로 수정합니다.

이번 실습에서는 다음 세 가지 status code만 사용합니다.

| Status Code | 의미 | 이번 실습에서의 사용 |
| --- | --- | --- |
| `201` | Created | 요청을 정상적으로 처리하고 새로운 리소스가 생성됨 |
| `400` | Bad Request | 클라이언트가 잘못된 값을 전송 |
| `500` | Internal Server Error | 서버 내부 처리 중 예상하지 못한 오류 발생 |

예를 들어 URL이 입력되지 않은 경우는 서버의 문제가 아니라 클라이언트 요청의 문제입니다.

```js
if (!originalUrl) {
  return NextResponse.json(
    {
      error: {
        code: "MISSING_URL",
        message: "Original URL is required.",
      },
    },
    { status: 200 } // TODO
  );
}
```

`route.js`에 있는 모든 `status: 200`를 찾아 상황에 맞게 수정합니다.

---

## 4. 기존 `page.js` 수정

2주차의 `page.js`에는 Backend API가 없었기 때문에 `handleSubmit()` 안에서 0.8초를 기다린 뒤 임시 메시지를 표시했습니다.

기존 코드를 새 `page.js`로 덮어쓰지 않고, **이 부분을 직접 수정합니다.**

### 수정 전 코드 찾기

`app/page.js`의 `handleSubmit()`에서 다음 부분을 찾습니다.

```js
setIsLoading(true);

await new Promise((resolve) => {
  setTimeout(resolve, 800);
});

setResult(
  "입력값 검증이 완료되었습니다. 아직 Backend API와 연결되진 않았습니다."
);
setIsLoading(false);
```

이 코드는 실제 서버에 요청을 보내지 않습니다.

```text
Shorten 클릭
→ 입력값 검증
→ 0.8초 대기
→ 임시 성공 메시지 표시
```

3주차에는 이 부분을 실제 Backend API 호출로 변경합니다.

---

## 5. `fetch()`로 Backend API 호출

먼저 다음과 같이 `/api/shorten`에 `POST` 요청을 보냅니다.

```js
const response = await fetch("/api/shorten", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    originalUrl,
  }),
});
```

각 부분의 의미는 다음과 같습니다.

| 코드 | 의미 |
| --- | --- |
| `fetch("/api/shorten", ...)` | Backend API에 HTTP 요청 |
| `method: "POST"` | 데이터를 서버로 보내는 POST 요청 |
| `Content-Type: "application/json"` | JSON 형식의 데이터를 보냄 |
| `JSON.stringify(...)` | JavaScript 객체를 JSON 문자열로 변환 |

서버가 보낸 JSON 응답은 다음과 같이 읽습니다.

```js
const data = await response.json();
```

---

## 6. 성공 응답과 오류 응답 구분

`fetch()`가 완료되었다고 해서 항상 요청이 성공한 것은 아닙니다.

예를 들어 서버가 `400 Bad Request` 또는 `500 Internal Server Error`를 반환해도 `fetch()` 자체는 응답을 받을 수 있습니다.

따라서 다음과 같이 `response.ok`를 확인합니다.

```js
if (!response.ok) {
  setError(data.error?.message || "요청 처리에 실패했습니다.");
  return;
}
```

`response.ok`는 HTTP status code가 `200`번대일 때 `true`입니다.

성공한 경우에는 서버가 반환한 `shortUrl`을 화면에 표시합니다.

```js
setResult(data.shortUrl);
```

---

## 7. `try-catch-finally` 추가

네트워크 요청 과정에서는 서버에 연결할 수 없거나 예상하지 못한 오류가 발생할 수 있습니다.

따라서 API 호출 코드를 `try-catch-finally`로 감쌉니다.

기존의 다음 코드부터

```js
setIsLoading(true);
```

함수의 끝부분까지를 아래 코드로 교체합니다.

```js
setIsLoading(true);

try {
  const response = await fetch("/api/shorten", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      originalUrl,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    setError(data.error?.message || "요청 처리에 실패했습니다.");
    return;
  }

  setResult(data.shortUrl);
} catch {
  setError("서버에 연결할 수 없습니다.");
} finally {
  setIsLoading(false);
}
```

전체 흐름은 다음과 같이 변경됩니다.

```text
Shorten 버튼 클릭
→ handleSubmit 실행
→ validateUrl로 클라이언트 입력값 검증
→ fetch()로 POST /api/shorten 요청
→ Route Handler에서 요청 처리
→ HTTP status code와 JSON 응답 반환
→ response.ok 확인
→ 성공 결과 또는 오류 메시지 표시
```

---

## 8. 화면 안내 문구 수정

지난주 화면 아래에는 다음 안내가 표시되어 있습니다.

```jsx
<p>
  이번 주에는 <code>validateUrl</code> 함수를 완성해 입력값 검증을
  구현합니다.
</p>
```

3주차에는 이 문구도 수정합니다.

예:

```jsx
<p>
  이번 주에는 <code>Route Handler</code>를 만들고 Backend API와
  연결합니다.
</p>
```

---

## 실행 및 테스트

프로젝트 루트에서 개발 서버를 실행합니다.

```bash
npm run dev
```

브라우저에서 다음 주소를 엽니다.

```text
http://localhost:3000
```

### 정상 요청 테스트

다음 URL을 입력합니다.

```text
https://www.google.com
```

정상적으로 처리되면 short URL이 표시되어야 합니다.

예:

```text
http://localhost:3000/XEZ9AE
```

short code는 입력한 URL에 따라 달라질 수 있습니다.

---

## Browser Network 탭에서 확인

Chrome 개발자 도구를 열고 다음 위치를 확인합니다.

```text
Developer Tools
→ Network
→ shorten
```

`shorten` 요청을 선택하여 다음 내용을 확인합니다.

- Request Method가 `POST`인지 확인
- Status Code 확인
- Request Payload의 `originalUrl` 확인
- Response의 JSON 확인

정상 요청에서는 다음과 같이 확인할 수 있습니다.

```text
Request URL: http://localhost:3000/api/shorten
Request Method: POST
Status Code: 201
```

---

## 오류 응답 테스트

브라우저 화면에서는 2주차에 작성한 `validateUrl()`이 먼저 잘못된 입력을 차단합니다.

따라서 Backend API의 `400` 응답을 직접 확인하려면 개발자 도구 Console에서 `fetch()`를 실행할 수 있습니다.

### URL을 보내지 않는 요청

```js
fetch("/api/shorten", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({}),
}).then(async (response) => ({
  status: response.status,
  body: await response.json(),
})).then(console.log);
```

기대 결과:

```text
status: 400
```

### 잘못된 URL 요청

```js
fetch("/api/shorten", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    originalUrl: "not-a-url",
  }),
}).then(async (response) => ({
  status: response.status,
  body: await response.json(),
})).then(console.log);
```

기대 결과:

```text
status: 400
```

---

## 테스트 체크리스트

| 테스트 | 기대 결과 |
| --- | --- |
| `https://www.google.com` 입력 | short URL 표시 |
| 정상 API 요청 | HTTP `201` |
| `originalUrl`이 없는 API 요청 | HTTP `400` |
| 잘못된 URL을 API로 직접 전송 | HTTP `400` |
| Network 탭의 Request Payload | 입력한 `originalUrl` 확인 |
| Network 탭의 Response | `shortCode`, `shortUrl`, `originalUrl` 확인 |

---

## 프로덕션 빌드 확인

제출 전에 프로덕션 빌드가 성공하는지 확인합니다.

```bash
npm run build
```

오류가 발생하면 commit하기 전에 수정합니다.

---

## commit, push, 자동 배포

변경된 파일을 확인합니다.

```bash
git status
git diff
```

이번 주에는 기존 `page.js`를 수정하고 새로운 Route Handler를 추가했습니다.

```bash
git add app/page.js app/api/shorten/route.js
git commit -m "Complete week 03 backend API"
git push
```

GitHub에 push하면 기존에 연결한 Vercel 프로젝트에서 자동 빌드와 배포가 시작됩니다.

배포가 완료되면 Vercel URL에서도 URL 단축 요청이 정상적으로 처리되는지 확인합니다.

```text
기존 page.js 수정
→ Route Handler 추가
→ HTTP status code 완성
→ 로컬 테스트
→ commit
→ GitHub push
→ Vercel 자동 빌드
→ 클라우드에 새 버전 배포
```
