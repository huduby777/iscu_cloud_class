import { findUrlByShortCode } from "../../lib/db";
import { recordClick } from "../../lib/stats";

export async function GET(request, { params }) {
  const { shortCode } = await params;

  const originalUrl = await findUrlByShortCode(shortCode);

  // 5주차 todo=================
  if (!originalUrl) {
    // 6주차 todo
    // url이 존재하지 않는 경우 에러 로그 남기기
    console.warn("Short URL not found", { shortCode });

    return new Response("해당 페이지를 찾을 수 없습니다.", {
      status: 404,
    });
  }
  //=================

  // 6주차 todo=================
  try{
    await recordClick(shortCode);
  } catch ( error ) {
    console.error("Faild to record click", {shortCode});
  }
  //=================

  return new Response(null, {
    status: 307,
    headers: {
      Location: originalUrl,          // originalUrl 주소로 임시 이동하라는 응답 상태 코드
      "Cache-Control": "no-store",    // 이 응답을 캐시에 저장하지 않도록 지정
    },
  });
}