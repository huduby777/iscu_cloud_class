# 5주차 실습: 짧은 URL로 원본 URL에 이동하기

이번 주차에서는 4주차에 Neon Postgres에 저장한 `shortCode`와 `originalUrl`을 조회하여, 사용자가 짧은 URL로 접속했을 때 원본 URL로 이동하도록 구현합니다.

## 실습 목표

- 단축 URL에 접속했을 때 데이터베이스에 저장된 원본 URL로 이동하는 처리 흐름 확인
- 주어진 코드에서 동적 라우트 구조와 처리 순서 확인
- 존재하지 않는 `shortCode`로 접속했을 때 `404 Not Found` 응답을 만드는 부분 완성
- 개발자 도구의 Network 탭에서 `307` 상태 코드, `Location`, `Cache-Control: no-store` 응답 헤더 확인
- 브라우저가 원본 사이트로 보낸 두 번째 요청과 `200` 응답 확인

> 캐시의 동작과 캐시 전략은 중간고사 이후 해당 주차에서 다시 심화하여 다룹니다.  
> 이번 실습에서는 요청과 리다이렉트 흐름을 명확하게 확인하기 위해 `Cache-Control: no-store`를 사용합니다.

---

## 1. 4주차 프로젝트 준비

4주차까지 완성한 URL Shortener 프로젝트를 준비합니다.

4주차 프로젝트에는 다음 기능이 구현되어 있어야 합니다.

```text
긴 URL 입력
      ↓
POST /api/shorten
      ↓
shortCode 생성
      ↓
Neon Postgres에 저장
      ↓
shortUrl 응답
```

이번 주차에서는 반대 방향의 흐름을 추가합니다.

```text
GET /{shortCode}
      ↓
shortCode 확인
      ↓
Neon Postgres 조회
      ↓
originalUrl 확인
      ↓
307 Redirect
```

---

## 2. 5주차 적용 후 프로젝트 구조

5주차에는 기존 프로젝트에 새로운 동적 라우트 파일 하나를 추가합니다.

```text
프로젝트/
├─ app/
│  ├─ page.js
│  │
│  ├─ api/
│  │  └─ shorten/
│  │     └─ route.js
│  │
│  └─ [shortCode]/
│     └─ route.js          ← 5주차에 추가
│
├─ lib/
│  └─ db.js                ← 조회 함수 추가
│
├─ package.json
└─ ...
```

이번 주차에서 수정하거나 추가하는 부분은 다음 두 곳입니다.

```text
lib/db.js
→ findUrlByShortCode() 함수 추가

app/[shortCode]/route.js
→ 제공된 파일 추가 후 404 처리 부분 완성
```

---

## 3. `lib/db.js`에 조회 함수 추가

4주차에 만든 `lib/db.js`에는 URL 매핑을 저장하는 `saveUrl()` 함수가 있습니다.

이번 주에는 `shortCode`를 이용해 데이터베이스에서 `originalUrl`을 조회하는 함수를 추가합니다.

기존 `lib/db.js`의 마지막에 다음 함수를 추가합니다.

```js
export async function findUrlByShortCode(shortCode) {
  const rows = await sql`
    SELECT original_url
    FROM urls
    WHERE short_code = ${shortCode}
    LIMIT 1
  `;

  return rows[0]?.original_url ?? null;
}
```

`findUrlByShortCode()`의 동작은 다음과 같습니다.

```text
shortCode
    ↓
urls 테이블 조회
    ↓
original_url이 존재함
    ↓
originalUrl 반환
```

조회 결과가 없으면 `null`을 반환합니다.

4주차와 5주차에서 같은 `urls` 테이블을 서로 다른 방향으로 사용한다는 점을 확인합니다.

```text
4주차

originalUrl
    ↓
shortCode 생성
    ↓
DB 저장


5주차

shortCode
    ↓
DB 조회
    ↓
originalUrl
```

---

## 4. 동적 라우트 파일 추가

제공된 다음 파일을 프로젝트에 추가합니다.

```text
app/[shortCode]/route.js
```

`[shortCode]`는 요청 URL의 해당 위치에 들어오는 값을 동적으로 받기 위한 폴더입니다.

예를 들어 다음 주소로 접속했다고 가정합니다.

```text
https://내프로젝트.vercel.app/aB3xK9
```

Next.js는 다음과 같이 `aB3xK9`를 `shortCode` 값으로 전달합니다.

```text
/aB3xK9
    ↓
[shortCode]
    ↓
shortCode = "aB3xK9"
```

제공된 `route.js`는 다음과 같은 구조입니다.

```js
import { findUrlByShortCode } from "../../lib/db";

export async function GET(request, { params }) {
  const { shortCode } = await params;

  const originalUrl = await findUrlByShortCode(shortCode);

  // TODO
  // originalUrl이 존재하지 않는 경우
  // 404 Not Found 응답을 반환하세요.


  return new Response(null, {
    status: 307,
    headers: {
      Location: originalUrl,
      "Cache-Control": "no-store",
    },
  });
}
```

현재 코드는 다음 순서로 동작합니다.

```text
GET /aB3xK9
      ↓
params에서 shortCode 확인
      ↓
findUrlByShortCode(shortCode)
      ↓
originalUrl 조회
      ↓
307 Redirect 응답
```

하지만 아직 한 가지 문제가 남아 있습니다.

---

## 5. 존재하지 않는 `shortCode` 처리 완성

다음과 같이 데이터베이스에 존재하지 않는 주소로 접속할 수 있습니다.

```text
https://내프로젝트.vercel.app/abcdef
```

만약 `abcdef`이라는 `shortCode`가 데이터베이스에 없다면 `findUrlByShortCode()`는 `null`을 반환합니다.

이 경우 원본 URL이 없으므로 Redirect를 수행하면 안 됩니다.

```text
GET /abcdef
      ↓
DB 조회
      ↓
결과 없음
      ↓
404 Not Found
```

제공된 `app/[shortCode]/route.js`의 `TODO` 부분을 완성하여 다음 조건을 만족하도록 구현합니다.

```text
originalUrl이 존재하지 않음
      ↓
HTTP Status Code: 404
      ↓
Redirect 수행하지 않음
```

> 이번 실습에서 학생이 직접 완성해야 하는 핵심 코드입니다.

---

## 6. 정상적인 Redirect 확인

4주차에서 저장한 URL 중 하나의 `shortCode`를 확인합니다.

예:

```text
short_code | original_url
-----------+------------------------
aB3xK9     | https://www.google.com
```

브라우저에서 다음 주소로 접속합니다.

```text
https://내프로젝트.vercel.app/aB3xK9
```

정상적으로 구현되었다면 브라우저가 원본 URL로 이동합니다.

```text
/aB3xK9
   ↓
DB에서 originalUrl 조회
   ↓
307 Temporary Redirect
   ↓
https://www.google.com
```

---

## 7. 존재하지 않는 `shortCode` 확인

이번에는 데이터베이스에 저장되어 있지 않은 값을 입력합니다.

예:

```text
https://내프로젝트.vercel.app/zzzzzz
```

정상적으로 구현되었다면 원본 사이트로 이동하지 않고 `404 Not Found` 응답이 발생해야 합니다.

개발자 도구의 Network 탭에서도 상태 코드를 확인합니다.

```text
Status Code: 404
```

---

## 8. Network 탭에서 `307` 응답 확인

Chrome 개발자 도구를 열고 **Network** 탭으로 이동합니다.

Redirect가 발생하면 브라우저가 다른 주소로 이동하므로, 이전 요청 기록이 사라지지 않도록 다음 옵션을 체크합니다.

```text
Preserve log
```

그다음 정상적인 short URL에 다시 접속합니다.

예:

```text
https://내프로젝트.vercel.app/aB3xK9
```

Network 탭에서는 두 번의 요청을 확인할 수 있습니다.

```text
첫 번째 요청

GET /aB3xK9
      ↓
307 Temporary Redirect


두 번째 요청

GET https://www.google.com
      ↓
200 OK
```

첫 번째 요청은 URL Shortener 서비스가 반환한 응답이고, 두 번째 요청은 브라우저가 원본 사이트로 새롭게 보낸 요청입니다.

---

## 9. Redirect 응답 헤더 확인

Network 탭에서 첫 번째 요청을 선택하고 Response Headers를 확인합니다.

다음 항목을 확인합니다.

```text
Status Code
307 Temporary Redirect
```

```text
Location
https://www.google.com
```

```text
Cache-Control
no-store
```

각 항목의 의미는 다음과 같습니다.

| 항목 | 의미 |
|---|---|
| `307 Temporary Redirect` | 브라우저에게 다른 주소로 다시 요청하도록 지시 |
| `Location` | 브라우저가 이동해야 할 원본 URL |
| `Cache-Control: no-store` | 이번 응답을 캐시에 저장하지 않도록 지시 |

Redirect 응답 자체가 원본 웹사이트의 응답은 아닙니다.

```text
URL Shortener
GET /aB3xK9
      ↓
307 + Location
      ↓
브라우저
      ↓
원본 사이트에 새로운 GET 요청
      ↓
200 OK
```

---

## 10. Vercel에 배포하여 확인

코드를 GitHub에 commit하고 push합니다.

Vercel의 새 Deployment가 완료된 뒤 다음 항목을 다시 확인합니다.

### 정상 shortCode

```text
https://내프로젝트.vercel.app/{실제 shortCode}
```

- 원본 URL로 이동하는지 확인
- Network 탭에서 첫 번째 요청이 `307`인지 확인
- `Location` 헤더가 원본 URL인지 확인
- `Cache-Control`이 `no-store`인지 확인
- Redirect 후 원본 사이트의 요청이 `200`인지 확인

### 존재하지 않는 shortCode

```text
https://내프로젝트.vercel.app/zzzzzz
```

- 원본 사이트로 이동하지 않는지 확인
- 상태 코드가 `404`인지 확인

---

## 이번 주 핵심

4주차에는 URL 매핑을 데이터베이스에 **저장**했습니다.

```text
POST /api/shorten
      ↓
shortCode 생성
      ↓
DB 저장
      ↓
shortUrl 응답
```

5주차에는 저장한 매핑을 **조회**하여 실제 Redirect 기능을 완성합니다.

```text
GET /{shortCode}
      ↓
DB 조회
      ↓
originalUrl 존재?
   ↙          ↘
 아니오        예
   ↓           ↓
404         307 Redirect
               ↓
          원본 사이트 요청
               ↓
             200
```

이번 실습에서 중요한 것은 단순히 원본 사이트로 이동하는 결과만 확인하는 것이 아니라,

```text
동적 라우트
→ shortCode 추출
→ DB 조회
→ 404 또는 307 응답
→ Location 헤더
→ 브라우저의 두 번째 요청
```

이라는 전체 처리 흐름을 이해하는 것입니다.

---

## 확인 체크리스트

- [ ] 4주차 프로젝트와 Neon DB가 정상적으로 준비되어 있는가?
- [ ] `lib/db.js`에 `findUrlByShortCode()`를 추가했는가?
- [ ] `app/[shortCode]/route.js`를 프로젝트에 추가했는가?
- [ ] `[shortCode]`가 동적 라우트라는 의미를 확인했는가?
- [ ] 존재하지 않는 `shortCode`에 대해 `404 Not Found`가 반환되도록 TODO를 완성했는가?
- [ ] 실제 short URL로 접속했을 때 원본 사이트로 이동하는가?
- [ ] Network 탭에서 첫 번째 요청의 `307` 상태 코드를 확인했는가?
- [ ] `Location` 응답 헤더가 원본 URL인지 확인했는가?
- [ ] `Cache-Control: no-store`를 확인했는가?
- [ ] Redirect 후 브라우저가 원본 사이트로 보낸 두 번째 요청과 `200` 응답을 확인했는가?
