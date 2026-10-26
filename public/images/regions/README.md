# 지역 카드 이미지 반입 보류

2026-10-26 조사: RN의 `assets/images/regions/`에서 아래 파일과 사용 코드는 확인했으나 파일별 원본 출처·저작권자·웹 공개/재배포 허가를 입증하는 기록은 찾지 못했다. 루트의 Expo MIT LICENSE만으로 사진의 사용 권리를 확인할 수 없다.

사용자가 사용 권리가 확인된 파일만 복사하도록 지정했으므로 **현재 복사한 이미지 파일은 없다**. 외부 이미지나 임의의 사진으로 대체하지 않는다. 현재 지역 카드는 이미지 없는 배경으로 표시한다.

| 원본 파일 | 지역 | 확인할 사항 |
| --- | --- | --- |
| seongsu.png | 성수 | 원본 출처, 권리자, 웹 공개/재배포 허가, 필요한 출처 표기 |
| hongdae.png | 홍대·신촌 | 동일 |
| yeouido.png | 여의도 | 동일 |
| gangnam.png | 강남·서초 | 동일 |
| tokyo.png | 도쿄 | 동일 |
| osaka.png | 오사카 | 동일 |
| kyoto.png | 교토 | 동일 |
| nagoya.png | 나고야 | 동일 |

확인 후 원본 경로 `C:/dev/popku-rn/assets/images/regions/`에서 이 디렉터리로 해당 파일만 복사하고, `shared/utils/placeRegions.ts`의 그 카드 `image`를 `/images/regions/파일명.png`로 설정한다. 필요한 라이선스·출처 고지도 함께 보존한다. 컴포넌트에는 이미지 크기·cover·lazy loading이 준비되어 있다.
