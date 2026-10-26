// 메인 홍보 영역 전용 문구. API의 publicId를 그대로 키로 사용합니다.
// 확인된 publicId에 해당하는 항목만 추가하세요. 예시 숫자 ID는 사용하지 않습니다.
// 등록 형식: '확인한 publicId': '첫 번째 줄\n두 번째 줄',
// 미등록 또는 공백 문구는 기존 팝업 제목으로 표시됩니다.
export const carouselHeadlines: Readonly<Partial<Record<string, string>>> = {
  '396d2d8d-ced3-11f1-8f12-1258b46d816b': '아일릿의 새로운 이야기,\nBREAK EVEN 팝업',
  '74f2da0d-cedc-11f1-8f12-1258b46d816b': '용산에서 만나는\n사코팍의 특별한 7일',
  '299a1835-c770-11f1-8f12-1258b46d816b': '도쿄 에비스에 찾아온\nK-뷰티 팝업',
}
