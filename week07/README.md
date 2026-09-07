# 7주차 실습: 관리자 기능 보호와 공개 API 요청 제한

6주차에는 `/admin` 화면과 `/api/stats`를 통해 통계를 확인했습니다. 이번 주에는 여기에 다음 보호 기능을 추가합니다.

- 관리자 비밀번호를 환경변수로 관리
- 인증(Authentication)과 인가(Authorization)를 분리하여 구현
- `/admin` 화면 보호
- `/api/stats` 통계 API도 별도로 보호
- Vercel Firewall에서 `/api/shorten` Rate Limit 적용

> 이번 실습의 핵심은 **화면을 숨기는 것과 실제 데이터를 보호하는 것은 다르다**는 점입니다. `/admin`을 보호하더라도 `/api/stats`를 직접 요청할 수 있다면 통계 데이터는 보호된 것이 아닙니다.

---

## 실습 TODO

이번 주차에는 TODO를 직접 추론해서 해결하지 않습니다. **README에 제시된 완성 코드를 해당 위치에 그대로 옮겨 적으면서** 인증·인가·API 보호 흐름을 확인합니다.

```text
TODO 1. 인증 조건 코드 옮기기
TODO 2. 인가 조건 코드 옮기기
TODO 3. /api/stats 보호 코드 옮기기
```

각 TODO는 1~3줄 정도이며, 나머지 Basic Auth 파싱, 401/403 응답, `/admin` 보호용 Proxy 등의 골격은 제공됩니다.

이번 실습의 목표는 코드를 맞히는 것이 아니라 **각 코드가 왜 그 위치에 들어가는지 이해하고, 실제 요청이 어떻게 차단되는지 확인하는 것**입니다.

---

# 1. 6주차 프로젝트에서 시작하기

6주차 실습까지 진행한 본인의 프로젝트를 준비합니다.

현재 흐름은 다음과 같습니다.

```text
/admin
   ↓
GET /api/stats
   ↓
Neon Postgres
   ↓
통계 JSON
   ↓
/admin 화면에 표시
```

먼저 배포된 프로젝트에서 다음 주소를 직접 확인합니다.

```text
https://내프로젝트.vercel.app/admin
https://내프로젝트.vercel.app/api/stats
```

아직 인증을 적용하지 않았다면 둘 다 직접 접근할 수 있습니다.

특히 다음 요청이 가능하다는 점을 확인합니다.

```text
사용자
  │
  └────────────→ GET /api/stats
                       ↓
                  통계 JSON 반환
```

`/admin` 페이지의 주소를 숨기거나 메뉴에서 링크를 제거하는 것만으로는 통계 API를 보호할 수 없습니다.

---

# 2. 파일 복사

기존 프로젝트에 다음 파일을 복사합니다.

```text
lib/auth.js
lib/authorization.js
proxy.js
```

프로젝트 구조는 대략 다음과 같습니다.

```text
프로젝트/
├─ app/
│  ├─ admin/
│  │  └─ page.js                 
│  └─ api/
│     ├─ shorten/
│     │  └─ route.js             
│     └─ stats/
│        └─ route.js             
│
├─ lib/
│  ├─ db.js                      
│  ├─ stats.js                   
│  ├─ auth.js                    ← 제공 파일
│  └─ authorization.js           ← 제공 파일
│
├─ proxy.js                      ← 제공 파일
└─ .env.local                    
```

---

# 3. 관리자 비밀번호를 환경변수로 관리하기

관리자 비밀번호를 코드에 직접 작성하지 않습니다.

```js
// 이렇게 작성하지 않습니다.
const ADMIN_PASSWORD = "cloud1234";
```

로컬에서는 프로젝트 루트에 있는 `.env.local` 파일에 다음 값을 추가 설정합니다.

```env
ADMIN_PASSWORD=본인이_정한_비밀번호
```

Vercel에도 동일한 이름의 환경변수를 등록합니다.

```text
ADMIN_PASSWORD
```

> `NEXT_PUBLIC_ADMIN_PASSWORD`처럼 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. 관리자 비밀번호는 브라우저 JavaScript에 포함되어서는 안 되는 Secret입니다.

---

# 4. 인증과 인가를 분리해서 생각하기

이번 실습에서는 인증과 인가를 서로 다른 함수로 구현합니다.

```text
authenticate(request)
→ 이 요청을 보낸 사용자는 누구인가?
→ 인증 성공: user 반환
→ 인증 실패: null 반환

                 ↓

authorize(user, permission)
→ 이 사용자가 이 기능을 사용해도 되는가?
→ 허용: true
→ 거부: false
```

이번 실습에서 사용하는 관리자 권한은 다음 두 가지입니다.

```text
admin
  ├─ admin:page
  └─ stats:read
```

| 권한 | 의미 |
|---|---|
| `admin:page` | `/admin` 화면 접근 |
| `stats:read` | `/api/stats` 통계 조회 |

현재 실습에서는 관리자 계정 하나만 사용합니다. 실제 사용자 관리 시스템을 만드는 것이 아니라 **인증과 인가의 책임을 코드에서도 구분하는 것**이 목적입니다.

---

# 5. TODO 1: 인증 조건 코드 옮기기

파일을 엽니다.

```text
lib/auth.js
```

Basic Authentication에서는 요청의 `Authorization` 헤더에 `username:password`가 Base64로 인코딩되어 전달됩니다.

제공된 `auth.js`에는 다음 작업이 이미 구현되어 있습니다.

```text
Authorization 헤더 읽기
        ↓
Basic 형식 확인
        ↓
Base64 디코딩
        ↓
username과 password 분리
```

파일에서 다음 TODO를 찾습니다.

```js
// TODO 1. 아래 false를 올바른 관리자 계정인지 확인하는 조건식으로 바꾸세요.
const isValidAdmin = false;
```

위 코드를 다음과 같이 바꿉니다.

```js
const isValidAdmin =
  username === "admin" &&
  password === process.env.ADMIN_PASSWORD;
```

이 코드는 두 조건을 모두 확인합니다.

```text
사용자 이름이 admin인가?
AND
입력한 비밀번호가 ADMIN_PASSWORD와 같은가?
```

인증에 성공하면 제공된 나머지 코드가 다음 사용자 정보를 반환합니다.

```js
{
  username,
  role: "admin",
}
```

인증에 실패하면 `null`을 반환합니다.

> Base64는 암호화가 아닙니다. Basic Authentication은 HTTPS 환경에서 사용해야 합니다. 이번 실습에서는 인증·인가 흐름을 간단하게 관찰하기 위해 Basic Authentication을 사용합니다.

---

# 6. TODO 2: 인가 조건 코드 옮기기

파일을 엽니다.

```text
lib/authorization.js
```

역할별 권한 목록은 이미 제공되어 있습니다.

```js
const ROLE_PERMISSIONS = {
  admin: ["admin:page", "stats:read"],
};
```

`authorize()` 함수는 현재 사용자의 role에 해당하는 권한 목록까지 가져옵니다.

```js
const permissions = ROLE_PERMISSIONS[user.role] ?? [];
```

파일에서 다음 TODO를 찾습니다.

```js
// TODO 2. 아래 false를 현재 role이 permission을 가지고 있는지 확인하는 식으로 바꾸세요.
return false;
```

위 코드를 다음 한 줄로 바꿉니다.

```js
return permissions.includes(permission);
```

따라서 다음과 같은 판단이 가능해집니다.

```text
admin + admin:page
→ true

admin + stats:read
→ true

admin + 존재하지 않는 권한
→ false
```

인증 함수는 **누구인지** 확인하고, 인가 함수는 인증된 사용자가 **요청한 기능을 사용할 권한이 있는지** 확인합니다.

---

# 7. TODO 3: 본인의 6주차 `/api/stats`에 보호 코드 옮기기

**이 단계에서도 새로운 `route.js` 완성본을 복사하지 않습니다.**

본인이 6주차에서 작성한 다음 파일을 엽니다.

```text
app/api/stats/route.js
```

6주차에서 작성한 통계 조회 코드는 그대로 유지하고, 이번 주에는 그 앞에 인증·인가 보호 코드만 추가합니다.

## 7-1. import 추가

기존 import 아래에 다음 두 줄을 그대로 추가합니다.

```js
import { authenticate } from "../../../lib/auth";
import { authorize } from "../../../lib/authorization";
```

## 7-2. 401 / 403 응답 함수 추가

기존 `GET` 함수보다 위에 다음 코드를 그대로 추가합니다.

```js
function authenticationRequiredResponse() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Admin"',
      "Cache-Control": "no-store",
    },
  });
}

function forbiddenResponse() {
  return new Response("Forbidden", {
    status: 403,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
```

## 7-3. `GET`에서 request 받기

기존 코드가 다음과 같다면

```js
export async function GET() {
```

다음과 같이 바꿉니다.

```js
export async function GET(request) {
```

## 7-4. TODO 3: 통계 조회 전에 인증·인가 코드 추가

**본인이 6주차에 작성한 통계 조회 코드보다 앞에** 다음 세 줄을 그대로 추가합니다.

```js
const user = authenticate(request);
if (!user) return authenticationRequiredResponse();
if (!authorize(user, "stats:read")) return forbiddenResponse();
```

각 줄의 역할은 다음과 같습니다.

```text
authenticate(request)
→ 요청을 보낸 사용자가 누구인지 확인

!user
→ 인증할 수 없으면 401 반환

!authorize(user, "stats:read")
→ 인증은 되었지만 통계를 읽을 권한이 없으면 403 반환
```

그 아래에는 **6주차에서 본인이 구현한 통계 조회 코드를 그대로 유지**합니다.

최종 흐름은 다음과 같습니다.

```text
GET /api/stats
      ↓
authenticate(request)
      ↓
인증 실패 → 401
      ↓
authorize(user, "stats:read")
      ↓
인가 실패 → 403
      ↓
6주차에서 본인이 구현한 통계 조회 코드
      ↓
200 + JSON
```

> 7주차 starter에는 6주차 `route.js`의 완성본이 없습니다. 따라서 6주차 실습 정답을 새 starter에서 가져올 수는 없습니다.

---

# 8. `/admin` 보호 코드 확인하기

프로젝트 루트에 제공된 `proxy.js`를 추가합니다.

이 파일은 **완성 코드**입니다.

다음 경로에만 적용됩니다.

```js
export const config = {
  matcher: ["/admin/:path*"],
};
```

핵심 부분을 읽어 봅니다.

```js
const user = authenticate(request);

if (!user) {
  return authenticationRequiredResponse();
}

if (!authorize(user, "admin:page")) {
  return forbiddenResponse();
}
```

흐름은 다음과 같습니다.

```text
GET /admin
    ↓
proxy.js
    ↓
인증: 누구인가?
    ↓
인가: admin:page 권한이 있는가?
    ↓
/admin 페이지
```

인증 정보가 없으면 `401`과 다음 헤더를 반환합니다.

```http
WWW-Authenticate: Basic realm="Admin"
```

브라우저는 이 응답을 이용해 Basic Authentication 입력 창을 표시할 수 있습니다.

---

# 9. 로컬에서 동작 확인하기

개발 서버를 실행합니다.

```bash
npm run dev
```

브라우저에서 다음 주소를 엽니다.

```text
http://localhost:3000/admin
```

다음 값을 입력합니다.

```text
사용자 이름: admin
비밀번호: .env.local의 ADMIN_PASSWORD 값
```

확인합니다.

```text
인증 정보 없음
→ 401

잘못된 비밀번호
→ 401

올바른 admin / password
→ /admin 접근 가능
```

현재 실습에는 일반 사용자 계정이 없으므로 정상 사용 과정에서는 `403`을 직접 보지 않을 수 있습니다. 그러나 코드에서는 인증과 인가가 서로 다른 단계로 분리되어 있습니다.

---

# 10. `/api/stats`를 직접 요청해 보기

이 단계가 이번 실습의 핵심 확인 과정입니다.

새 시크릿 창 등을 이용하여 다음 주소를 직접 요청합니다.

```text
http://localhost:3000/api/stats
```

TODO 3을 올바르게 구현했다면 인증하지 않은 사용자가 통계 JSON을 바로 볼 수 없어야 합니다.

```text
GET /api/stats
      ↓
인증 정보 없음
      ↓
401 Unauthorized
```

관리자로 인증한 뒤에는 통계 데이터를 조회할 수 있어야 합니다.

여기서 다음 두 보호를 구분합니다.

```text
/admin 보호
→ 관리자 화면 보호

/api/stats 보호
→ 실제 통계 데이터 보호
```

**실제 자원을 반환하는 서버 측 경로에서도 접근 권한을 확인해야 합니다.**

---

# 11. Vercel에 배포하기

코드를 commit하고 push합니다.

Vercel 프로젝트에 다음 환경변수를 등록합니다.

```text
ADMIN_PASSWORD
```

환경변수 변경 후 새 Deployment에서 적용되었는지 확인합니다.

배포 후 다음 두 주소를 테스트합니다.

```text
https://내프로젝트.vercel.app/admin
https://내프로젝트.vercel.app/api/stats
```

그리고 GitHub 저장소에서 확인합니다.

```text
ADMIN_PASSWORD라는 환경변수 이름
→ 코드에 있어도 됨

실제 관리자 비밀번호 값
→ 코드에 있으면 안 됨
```

---

# 12. `/api/shorten`에 Rate Limit 적용하기

`/api/shorten`은 일반 사용자가 사용하는 공개 API이므로 관리자 인증으로 막지 않습니다.

대신 한 요청 출처가 짧은 시간 동안 너무 많은 요청을 보내면 제한합니다.

이번 실습에서는 애플리케이션 코드가 아니라 **Vercel Firewall의 Rate Limiting 기능**을 사용합니다.

예시 정책:

```text
대상 경로: /api/shorten
HTTP Method: POST
기준: IP
Window: 60초
허용 횟수: 10회
초과 시: 429 Too Many Requests
```

Vercel 프로젝트의 Firewall 설정에서 다음 조건의 Rule을 만듭니다.

```text
Request Path = /api/shorten
AND
Request Method = POST
```

Action은 Rate Limit으로 설정합니다.

설정 화면의 메뉴 이름이나 세부 항목은 Vercel UI 변경에 따라 다를 수 있습니다.

설정을 저장하고 실제 배포 환경에 적용합니다.

---

# 13. Rate Limit 확인하기

짧은 시간 동안 `/api/shorten`에 반복해서 POST 요청을 보냅니다.

설정한 허용 횟수 이내에서는 기존 Route Handler가 실행됩니다.

한도를 초과하면 다음 응답을 확인합니다.

```http
HTTP/1.1 429 Too Many Requests
```

흐름은 다음과 같습니다.

```text
POST /api/shorten
      ↓
Vercel Firewall
      ↓
Rate Limit 검사
   ↙              ↘
허용              초과
 ↓                 ↓
Route Handler      429
 ↓
Database
```

이처럼 애플리케이션 앞단에서 요청을 제한하면 과도한 요청이 Route Handler나 데이터베이스에 도달하는 것을 줄일 수 있습니다.

---

# 14. 전체 흐름 정리

### 관리자 페이지

```text
GET /admin
    ↓
Proxy
    ↓
Authentication
"누구인가?"
    ↓
Authorization
"admin:page 권한이 있는가?"
    ↓
/admin
```

### 관리자 통계 API

```text
GET /api/stats
      ↓
Route Handler
      ↓
Authentication
"누구인가?"
      ↓
Authorization
"stats:read 권한이 있는가?"
      ↓
6주차 통계 조회 코드
      ↓
Database
```

### 공개 URL 생성 API

```text
POST /api/shorten
      ↓
Vercel Firewall Rate Limit
      ↓
허용 → Route Handler
초과 → 429 Too Many Requests
```

| 보호 수단 | 확인하는 질문 | 적용 대상 |
|---|---|---|
| 인증 | 이 사용자는 누구인가? | 관리자 요청 |
| 인가 | 이 사용자가 이 기능을 사용해도 되는가? | `/admin`, `/api/stats` |
| Rate Limit | 너무 많은 요청을 보내고 있는가? | `/api/shorten` |

---

# 확인 체크리스트

- [ ] 6주차 프로젝트에서 시작했는가?
- [ ] 6주차의 `app/api/stats/route.js`를 새로운 완성 파일로 교체하지 않았는가?
- [ ] `.env.local`에 `ADMIN_PASSWORD`를 설정했는가?
- [ ] 실제 비밀번호가 GitHub에 commit되지 않았는가?
- [ ] `NEXT_PUBLIC_ADMIN_PASSWORD`를 사용하지 않았는가?
- [ ] README의 TODO 1 코드를 `auth.js`의 해당 위치에 옮겼는가?
- [ ] README의 TODO 2 코드를 `authorization.js`의 해당 위치에 옮겼는가?
- [ ] `proxy.js`에서 인증과 인가가 어떻게 적용되는지 확인했는가?
- [ ] README의 TODO 3 코드를 본인의 기존 `/api/stats`에 추가했는가?
- [ ] 인증하지 않고 `/admin`에 접근하면 차단되는가?
- [ ] 인증하지 않고 `/api/stats`를 직접 요청해도 차단되는가?
- [ ] 올바른 관리자 인증 후 `/admin`과 `/api/stats`가 동작하는가?
- [ ] Vercel에 `ADMIN_PASSWORD` 환경변수를 등록했는가?
- [ ] `/api/shorten`에 Rate Limit을 적용했는가?
- [ ] 한도를 초과했을 때 `429 Too Many Requests`를 확인했는가?
