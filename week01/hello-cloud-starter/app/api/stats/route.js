// 7주차
import { authenticate  } from "../../../lib/auth";
import { authorize } from "../../../lib/authorization";

// 6주차
import {
  getSummaryStats,
  getTopUrl,
  getUrlStats,
} from "../../../lib/stats";

export const dynamic = "force-dynamic";


function authenticationRequiredResponse() {
  return new Response("Authentication required", {
    status : 401,
    header:{
      "WWW-Authenticate" : 'Basic realm="Admin"',
      "Cache-Control":"no-store"
    }
  });
}

function forbiddenResponse(){
  return new Response("Forbidden",{
    status : 403,
    headers : {
      "Cache-Control":"no-store"
    }
  });
}

export async function GET(request) {
  const user = authenticate(request);
  if(!user) return authenticationRequiredResponse();
  if(!authorize(user,"stats:read")) return forbiddenResponse();


  try {
    const summary = await getSummaryStats();
    const topUrl = await getTopUrl();
    const urls = await getUrlStats();

    // 6주차 todo ==
    // summary, topUrl, urls를 하나의 JSON 응답으로 반환하세요.
    // README의 목표 JSON 구조를 참고하세요.
    // console.log(summary);
    return Response.json(
      {
        summary: {
          totalUrls: summary.totalUrls /* TODO */,
          totalClicks: summary.totalClicks/* TODO */,
          clickedUrls: summary.clickedUrls/* TODO */,
          topUrl: topUrl /* TODO */,
        },
        urls: urls /* TODO */,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      } //============
    );

  } catch (error) {
    console.error("Failed to load stats", error);

    return Response.json(
      {
        error: {
          code: "STATS_ERROR",
          message: "Failed to load stats.",
        },
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
