<%@ page contentType="text/html; charset=utf-8" %><%@ page import="malgnsoft.util.*" %><%@ page import="malgnsoft.json.*" %><%@ include file="../init.jsp" %><%
/**
 * AI 튜터 챗봇 - 콜백 수신 JSP
 *
 * 챗봇 서버(Cloudflare Queue)에서 세션 생성 완료/실패 시 이 URL로 POST 요청을 보냅니다.
 * POST 요청만 처리합니다. GET 요청이나 빈 body는 무시합니다.
 */

LessonDao lesson = new LessonDao();
Json res = new Json(out);

try {
    // POST 요청만 처리
    if (!"POST".equalsIgnoreCase(request.getMethod())) {
        res.error(405, "POST 요청만 허용됩니다.");
        return;
    }

    // ── 1. 요청 Body 읽기 ──
    StringBuilder sb = new StringBuilder();
    java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(request.getInputStream(), "UTF-8"));
    String line;
    while ((line = reader.readLine()) != null) {
        sb.append(line);
    }
    reader.close();

    String requestBody = sb.toString().trim();
    if (requestBody.length() == 0 || !requestBody.startsWith("{")) {
        res.error(400, "유효한 JSON 요청 본문이 필요합니다.");
        return;
    }

    // ── 2. 콜백 데이터 파싱 (안전한 방식) ──
    JSONObject body = new JSONObject(requestBody);

    String generationStatus = body.optString("generationStatus", "");
    if (generationStatus.length() == 0) {
        res.error(400, "generationStatus가 없습니다.");
        return;
    }

    int sessionId = body.optInt("sessionId", 0);
    int cbSiteId = body.optInt("siteId", 0);
    String title = body.optString("title", "");
    String errorMsg = body.optString("error", "");

    // 세션 생성 시 전달된 값 (최상위)
    int lessonId = body.optInt("lessonId", 0);
    int courseId = body.optInt("courseId", 0);
    int cbUserId = body.optInt("userId", 0);

    // callbackData (없을 수 있음, LMS가 보낸 임의 데이터)
    JSONObject callbackData = body.optJSONObject("callbackData");

    // ── 3. DB 처리 ──

    if ("completed".equals(generationStatus)) {
        // ── 성공 처리 ──
        if (lessonId > 0 && sessionId > 0) {
            lesson.execute("UPDATE " + lesson.table + " SET ai_session_id = " + sessionId + " WHERE id = " + lessonId);
        }

        res.success("세션 생성 완료 처리됨", null);

    } else if ("failed".equals(generationStatus)) {
        // ── 실패 처리 ──
        Malgn.errorLog("{chatbot/callback} failed - sessionId:" + sessionId + " lessonId:" + lessonId + " error:" + errorMsg);

        res.success("세션 생성 실패 처리됨", null);

    } else {
        res.error(400, "알 수 없는 generationStatus: " + generationStatus);
    }

} catch (Exception e) {
    Malgn.errorLog("{chatbot/callback} " + e.getMessage(), e);
    res.error(500, e.getMessage());
}
%>
