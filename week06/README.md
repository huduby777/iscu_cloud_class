# 6주차 실습: 사용량을 기록하고 관리자 화면에서 확인하기

이번 주차에서는 5주차까지 완성한 URL Shortener에 **운영 데이터를 관찰하는 기능**을 추가합니다.

5주차까지는 단축 URL에 접속하면 데이터베이스에서 원본 URL을 조회한 뒤 `307 Redirect` 응답을 반환했습니다. 이번 주에는 이 흐름에 클릭 사용량을 기록하고, 로그와 `/api/stats`, `/admin` 화면을 통해 서비스의 상태를 확인하는 기능을 추가합니다.

## 실습 목표

- Redirect 요청이 발생했을 때 클릭 수와 최근 클릭 시간을 데이터베이스에 기록
- 정상 요청과 존재하지 않는 shortCode 요청의 로그 확인
- 데이터베이스의 여러 URL 데이터를 집계하여 `/api/stats`에서 JSON으로 제공
- `/admin` 화면에서 전체 사용량과 URL별 사용량 확인
- 통계 저장이 실패하더라도 핵심 기능인 Redirect는 계속 수행하는 정책 확인

> 이번 주차의 목적은 SQL 문법을 많이 작성하는 것이 아닙니다. 제공된 SQL의 의미를 읽고, **요청 → 기록 → 집계 → API → 관리자 화면**의 흐름을 이해하는 것이 핵심입니다.

---

## 1. 5주차 프로젝트 준비

5주차 실습까지 완료된 프로젝트를 준비합니다.

현재 Redirect 흐름은 다음과 같습니다.

```text
GET /{shortCode}
      ↓
params에서 shortCode 확인
      ↓
DB에서 originalUrl 조회
      ↓
originalUrl 존재?
   ↙          ↘
 아니오        예
   ↓           ↓
404         307 Redirect
               ↓
          원본 사이트
```

이번 주에는 5주차의 `app/[shortCode]/route.js` 의 코드에 **관찰과 사용량 기록 기능**을 추가합니다.

---

## 2. 6주차 적용 후 프로젝트 구조

제공된 파일을 기존 프로젝트에 다음 위치로 추가합니다.

```text
프로젝트/
├─ app/
│  ├─ page.js
│  │
│  ├─ api/
│  │  ├─ shorten/
│  │  │  └─ route.js
│  │  └─ stats/
│  │     └─ route.js        ← 제공 파일, TODO 1개 완성
│  │
│  ├─ admin/
│  │  └─ page.js            ← 제공 파일
│  │
│  └─ [shortCode]/
│     └─ route.js           ← 기존 파일을 직접 수정
│
├─ lib/
│  ├─ db.js
│  └─ stats.js              ← 제공 파일
│
├─ package.json
└─ ...
```

이번 주에 학생이 직접 작업하는 핵심 부분은 다음 두 곳입니다.

```text
app/[shortCode]/route.js
→ 클릭 기록과 로그 추가

app/api/stats/route.js
→ 집계 결과를 JSON으로 반환하는 TODO 완성
```

`lib/stats.js`와 `app/admin/page.js`는 완성된 파일을 제공합니다.

---

## 3. `urls` 테이블에 사용량 컬럼 추가

지금까지 `urls` 테이블에는 URL 매핑 정보가 저장되어 있습니다.

```text
short_code
original_url
created_at
```

6주차에는 다음 두 가지 사용량 정보를 추가합니다.

| 컬럼 | 의미 |
|---|---|
| `click_count` | 해당 short URL이 클릭된 총 횟수 |
| `last_clicked_at` | 가장 최근에 클릭된 시간 |

Neon의 **SQL Editor**에서 다음 SQL을 실행합니다.

```sql
ALTER TABLE urls
ADD COLUMN IF NOT EXISTS click_count BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ;
```

SQL의 의미는 다음과 같습니다.

```text
click_count
→ 기존 URL은 0부터 시작
→ NULL을 허용하지 않음

last_clicked_at
→ 아직 한 번도 클릭되지 않았다면 NULL
→ 클릭이 발생하면 최근 시각 저장
```

컬럼이 추가되었는지 확인합니다.

```sql
SELECT *
FROM urls
ORDER BY created_at DESC;
```

예상 형태:

```text
short_code | original_url | created_at | click_count | last_clicked_at
-----------+--------------+------------+-------------+----------------
aB3xK9     | ...          | ...        | 0           | NULL
```

---

## 4. `lib/stats.js` 추가

제공된 다음 파일을 프로젝트에 추가합니다.

```text
lib/stats.js
```

이 파일에는 이번 주에 필요한 데이터베이스 함수가 들어 있습니다.

```text
recordClick(shortCode)
→ 클릭 수와 최근 클릭 시간을 기록

getSummaryStats()
→ 전체 URL 수, 전체 클릭 수, 클릭된 URL 수 집계

getTopUrl()
→ 가장 많이 클릭된 URL 조회

getUrlStats()
→ URL별 클릭 수와 시간 정보 조회
```

### `recordClick()`

```js
export async function recordClick(shortCode) {
  await sql`
    UPDATE urls
    SET
      click_count = click_count + 1,
      last_clicked_at = NOW()
    WHERE short_code = ${shortCode}
  `;
}
```

한 번의 클릭이 발생하면 다음 두 값이 함께 변경됩니다.

```text
click_count      +1
last_clicked_at  현재 시간
```

### 대표 집계 SQL

`getSummaryStats()`에는 다음 SQL이 들어 있습니다.

```sql
SELECT
  COUNT(*) AS total_urls,
  COALESCE(SUM(click_count), 0) AS total_clicks,
  COUNT(*) FILTER (WHERE click_count > 0) AS clicked_urls
FROM urls;
```

각 항목의 의미를 확인합니다.

| SQL | 얻는 정보 |
|---|---|
| `COUNT(*)` | 전체 단축 URL 수 |
| `SUM(click_count)` | 전체 클릭 수 |
| `COUNT(*) FILTER (WHERE click_count > 0)` | 한 번 이상 클릭된 URL 수 |
| `COALESCE(..., 0)` | 합계 결과가 `NULL`이면 0으로 변환 |

이번 실습에서는 이 SQL을 처음부터 작성하지 않아도 됩니다. **여러 행의 데이터를 하나의 통계값으로 집계한다는 점**을 확인합니다.

또한 PostgreSQL의 `COUNT(*)`와 `SUM(...)` 결과는 JavaScript에서 문자열 형태로 전달될 수 있으므로, 제공된 코드에서는 `Number()`로 숫자형으로 변환합니다.

---

## 5. Redirect에서 클릭 기록하기

이제 기존 `app/[shortCode]/route.js`를 수정합니다.

먼저 상단에 다음 import를 추가합니다.

```js
import { recordClick } from "../../lib/stats";
```

현재 처리 순서는 다음과 같습니다.

```text
shortCode 확인
      ↓
originalUrl 조회
      ↓
404 또는 Redirect
```

이번 주에는 **원본 URL을 정상적으로 찾은 경우에만** 클릭을 기록해야 합니다.

어디에 `recordClick()`을 호출해야 하는지 생각한 뒤 다음 코드를 적절한 위치에 추가합니다.

```js
try {
  await recordClick(shortCode);
} catch (error) {
  console.error("Failed to record click", { shortCode });
}
```

완성 후 처리 순서는 다음과 같아야 합니다.

```text
shortCode 조회
      ↓
originalUrl 존재?
   ↙          ↘
 아니오        예
   ↓           ↓
404        recordClick()
               ↓
          307 Redirect
```

### 왜 `try/catch`를 사용하는가?

이번 실습에서는 다음 운영 정책을 사용합니다.

```text
원본 URL 조회 성공
      ↓
클릭 수 기록 시도
      ↓
기록 성공 ───────→ Redirect

기록 실패
      ↓
오류 로그 남김
      ↓
그래도 Redirect
```

URL Shortener의 핵심 기능은 사용자를 원본 URL로 보내는 것입니다.

따라서 이번 실습에서는 **통계 기록 실패 때문에 Redirect까지 실패시키지 않는 정책**을 사용합니다.

> 이 정책은 클릭 통계 일부가 누락될 가능성을 허용하는 대신 핵심 서비스의 가용성을 우선합니다.

---

## 6. 존재하지 않는 shortCode의 로그 남기기

5주차에서 이미 존재하지 않는 `shortCode`에 대해 `404`를 반환하도록 구현했습니다.

이번에는 이 상황을 로그에서도 확인할 수 있도록 `404`를 반환하기 전에 다음 코드를 추가합니다.

```js
console.warn("Short URL not found", { shortCode });
```

예:

```js
if (!originalUrl) {
  console.warn("Short URL not found", { shortCode });

  return new Response("Not Found", { status: 404 });
}
```

이 로그는 사용자에게 전달하는 응답이 아니라 **서비스를 운영하는 사람이 확인하는 기록**입니다.

```text
사용자
→ 404 응답 확인

운영자
→ Runtime Logs에서 어떤 shortCode가 조회되지 않았는지 확인
```

---

## 7. Vercel Runtime Logs 확인

코드를 GitHub에 commit하고 push한 뒤 Vercel Deployment가 완료될 때까지 기다립니다.

### 정상 short URL 확인

실제로 존재하는 short URL을 한 번 접속합니다.

```text
https://내프로젝트.vercel.app/{실제 shortCode}
```

원본 사이트로 정상적으로 이동하는지 확인합니다.

### 존재하지 않는 short URL 확인

이번에는 데이터베이스에 없는 값을 요청합니다.

```text
https://내프로젝트.vercel.app/zzzzzz
```

Vercel의 Runtime Logs에서 다음과 같은 로그를 확인합니다.

```text
Short URL not found
```

로그에 함께 기록된 `shortCode` 값도 확인합니다.

> Vercel 화면의 메뉴 이름이나 위치는 변경될 수 있습니다. 이번 실습의 핵심은 특정 메뉴를 외우는 것이 아니라, 배포된 서비스에서 Runtime Log를 찾아 실제 요청의 기록을 확인하는 것입니다.

---

## 8. 클릭 수가 실제로 저장되는지 확인

정상적인 short URL을 여러 번 클릭합니다.

예를 들어 동일한 short URL을 3번 접속합니다.

그다음 Neon SQL Editor에서 확인합니다.

```sql
SELECT
  short_code,
  click_count,
  last_clicked_at
FROM urls
ORDER BY click_count DESC;
```

예상 결과:

```text
short_code | click_count | last_clicked_at
-----------+-------------+-------------------------
aB3xK9     | 3           | 2026-08-22 ...
```

이번 단계에서는 아직 `/admin` 화면을 사용하지 않고, 실제로 **요청이 데이터로 기록되고 있는지** 데이터베이스에서 직접 확인합니다.

---

## 9. `/api/stats` 완성하기

제공된 다음 파일을 프로젝트에 추가합니다.

```text
app/api/stats/route.js
```

파일에는 다음 코드가 준비되어 있습니다.

```js
const summary = await getSummaryStats();
const topUrl = await getTopUrl();
const urls = await getUrlStats();
```

각 변수에는 다음 정보가 들어 있습니다.

```text
summary
→ 전체 URL 수
→ 전체 클릭 수
→ 클릭된 URL 수

topUrl
→ 가장 많이 클릭된 URL

urls
→ URL별 클릭 수
→ 생성 시간
→ 최근 클릭 시간
```

현재 파일의 `TODO`를 완성하여 이 데이터를 하나의 JSON 응답으로 반환합니다.
(힌트: lib/stats.js를 열어 각 함수가 어떤 값을 반환하는지 확인)

### 목표 JSON 구조

```json
{
  "summary": {
    "totalUrls": 12,
    "totalClicks": 148,
    "clickedUrls": 9,
    "topUrl": {
      "shortCode": "aB3xK9",
      "originalUrl": "https://www.google.com",
      "clickCount": 52
    }
  },
  "urls": [
    {
      "shortCode": "aB3xK9",
      "originalUrl": "https://www.google.com",
      "clickCount": 52,
      "createdAt": "...",
      "lastClickedAt": "..."
    }
  ]
}
```

아직 어떤 URL도 클릭되지 않았다면 다음과 같이 `topUrl`이 `null`일 수 있습니다.

```json
{
  "summary": {
    "totalUrls": 12,
    "totalClicks": 0,
    "clickedUrls": 0,
    "topUrl": null
  },
  "urls": []
}
```

> `urls`에는 저장된 URL이 존재한다면 클릭 수가 0이어도 포함됩니다. 위 예시는 JSON 구조를 간단히 보여주기 위한 예입니다.

---

## 10. `/api/stats` JSON 응답 확인

로컬 또는 Vercel에서 다음 주소로 접속합니다.

```text
https://내프로젝트.vercel.app/api/stats
```

정상적으로 구현되었다면 브라우저에 JSON 데이터가 표시됩니다.

확인할 항목:

```text
totalUrls
→ 전체 단축 URL 수와 일치하는가?

totalClicks
→ 지금까지 클릭한 횟수의 합과 일치하는가?

clickedUrls
→ 한 번 이상 클릭된 URL의 수와 일치하는가?

topUrl
→ 가장 많이 클릭한 URL인가?

urls
→ 각 URL의 클릭 수, 생성 시간, 최근 클릭 시간이 들어 있는가?
```

이 단계의 흐름은 다음과 같습니다.

```text
GET /api/stats
      ↓
DB에서 데이터 조회와 집계
      ↓
JavaScript 객체
      ↓
JSON Response
```

---

## 11. `/admin` 관리자 화면 추가

제공된 다음 파일을 프로젝트에 추가합니다.

```text
app/admin/page.js
```

이 파일은 완성된 상태로 제공됩니다.

페이지는 브라우저에서 다음 API를 호출합니다.

```text
GET /api/stats
```

그리고 받은 JSON을 다음과 같이 화면에 표시합니다.

```text
┌─────────────────┐
│ 전체 단축 URL 수 │
└─────────────────┘

┌─────────────────┐
│ 전체 클릭 수      │
└─────────────────┘

┌──────────────────────┐
│ 한 번 이상 클릭된 URL │
└──────────────────────┘

┌─────────────────────┐
│ 가장 많이 클릭된 URL │
└─────────────────────┘

URL별 사용량
──────────────────────────────────────────────
shortCode | originalUrl | 클릭 | 생성 | 최근 클릭
```

브라우저에서 다음 주소로 접속합니다.

```text
https://내프로젝트.vercel.app/admin
```

> 6주차에서는 `/admin`과 `/api/stats`를 아직 인증으로 보호하지 않습니다. 다음 주차에서 "화면 주소를 숨기는 것만으로 충분한가?"라는 문제에서 인증과 인가로 연결합니다.

---

## 12. 사용량 변화를 `/admin`에서 확인

관리자 화면을 열어 현재 숫자를 확인합니다.

예:

```text
전체 클릭 수: 5

aB3xK9 클릭 수: 3
```

이제 `aB3xK9` short URL을 3번 더 클릭합니다.

```text
/aB3xK9
/aB3xK9
/aB3xK9
```

다시 `/admin`으로 돌아가 **새로고침** 버튼을 누릅니다.

예상 변화:

```text
전체 클릭 수
5 → 8

aB3xK9 클릭 수
3 → 6

최근 클릭 시간
이전 시간 → 방금 클릭한 시간
```

이 단계에서 중요한 것은 화면 자체보다 다음 연결입니다.

```text
사용자 클릭
      ↓
Route Handler
      ↓
recordClick()
      ↓
Neon Postgres
      ↓
/api/stats
      ↓
/admin
```

---

## 13. 이번 주 전체 흐름

### 개별 요청을 관찰하는 로그

```text
GET /zzzzzz
      ↓
DB 조회 결과 없음
      ↓
console.warn()
      ↓
404 Response
      ↓
Vercel Runtime Logs에서 확인
```

### 여러 요청을 집계하는 사용량 데이터

```text
GET /aB3xK9
      ↓
DB에서 originalUrl 조회
      ↓
recordClick()
      ↓
click_count + 1
last_clicked_at 갱신
      ↓
307 Redirect
```

### 집계 결과를 모니터링하는 관리자 화면

```text
/admin
   ↓
GET /api/stats
   ↓
DB 집계
   ↓
JSON
   ↓
요약 카드 + URL별 사용량
```

로그와 통계는 같은 것이 아닙니다.

```text
로그
→ 개별 요청에서 어떤 일이 발생했는지 확인

사용량 통계
→ 여러 요청을 집계하여 서비스가 얼마나 사용되었는지 확인

/admin
→ 집계된 값을 한 화면에서 지속적으로 관찰
```

이번 실습의 `/admin`은 URL Shortener의 **비즈니스/사용량 데이터**를 관찰하는 간단한 대시보드입니다. 요청 지연 시간, 오류율, CPU 사용량 같은 시스템 운영 메트릭은 별도의 관측 대상입니다.

---

## 이번 주 핵심

5주차까지는 서비스를 **동작하게 만드는 것**이 중심이었습니다.

```text
short URL
   ↓
DB 조회
   ↓
Redirect
```

6주차에는 동작하는 서비스에 **관찰 지점**을 추가합니다.

```text
                  ┌─ Runtime Logs
                  │
GET /{shortCode} ─┤
                  │
                  └─ click_count / last_clicked_at
                              ↓
                         /api/stats
                              ↓
                           /admin
```

핵심 질문은 다음과 같습니다.

> 서비스가 동작하고 있다는 사실뿐 아니라, 실제로 어떻게 사용되고 있는지 어떻게 알 수 있는가?

---

## 확인 체크리스트

- [ ] 5주차 프로젝트가 정상적으로 동작하는가?
- [ ] `urls` 테이블에 `click_count`와 `last_clicked_at` 컬럼을 추가했는가?
- [ ] 제공된 `lib/stats.js` 파일을 추가했는가?
- [ ] `app/[shortCode]/route.js`에서 정상 URL의 클릭 수를 기록하도록 수정했는가?
- [ ] 클릭 기록에 실패하더라도 Redirect는 계속 수행되도록 했는가?
- [ ] 존재하지 않는 shortCode 요청에 `console.warn()` 로그를 추가했는가?
- [ ] Vercel Runtime Logs에서 존재하지 않는 shortCode의 로그를 확인했는가?
- [ ] 동일한 short URL을 여러 번 클릭했을 때 `click_count`가 증가하는가?
- [ ] `last_clicked_at`이 최근 클릭 시간으로 변경되는가?
- [ ] `app/api/stats/route.js`의 TODO를 완성했는가?
- [ ] `/api/stats`에서 JSON 응답을 확인했는가?
- [ ] `/admin`에서 전체 URL 수, 전체 클릭 수, 클릭된 URL 수, 최다 클릭 URL을 확인했는가?
- [ ] `/admin`에서 URL별 클릭 수, 생성 시간, 최근 클릭 시간을 확인했는가?
- [ ] short URL을 추가로 클릭한 뒤 `/admin`의 숫자가 변경되는지 확인했는가?
