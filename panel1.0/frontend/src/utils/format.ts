/**
 * 숫자에 3자리 콤마를 추가합니다.
 * @param value 숫자
 * @returns 콤마가 포함된 문자열 (예: 1,000)
 */
export function formatNumber(value: number): string {
  return value.toLocaleString();
}

/**
 * ISO 형식의 날짜 문자열을 "N분 전", "N시간 전" 등으로 변환합니다.
 * (참고: 현재 API는 이미 "2분 전" 같은 문자열을 반환하고 있어 당장 사용되진 않지만,
 * 백엔드에서 timestamp를 반환한다면 이 함수가 유용합니다.)
 * * @param dateString ISO 8601 날짜 문자열
 * @returns 상대 시간 문자열 (예: "2분 전")
 */
export function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000; // 1년 (초)
  if (interval > 1) {
    return Math.floor(interval) + "년 전";
  }
  interval = seconds / 2592000; // 1달
  if (interval > 1) {
    return Math.floor(interval) + "달 전";
  }
  interval = seconds / 86400; // 1일
  if (interval > 1) {
    return Math.floor(interval) + "일 전";
  }
  interval = seconds / 3600; // 1시간
  if (interval > 1) {
    return Math.floor(interval) + "시간 전";
  }
  interval = seconds / 60; // 1분
  if (interval > 1) {
    return Math.floor(interval) + "분 전";
  }
  return Math.floor(seconds) + "초 전";
}
