# 취향 카테고리 이미지 반입 보류

2026-10-26 RN `assets/images/categories/`의 실제 파일과 `PlaceInterestSection.tsx` 사용 순서를 확인했다. 파일별 원본 출처·권리자·웹 공개/재배포 허가를 입증하는 자료는 찾지 못했다. 사용 권리가 확인된 파일만 복사하라는 요청에 따라 **이미지를 복사하지 않았다**.

| RN 파일 | 카테고리 | 태그 ID |
| --- | --- | ---: |
| anime-character.webp | 캐릭터/IP | 1 |
| beauty.webp | 뷰티 | 5 |
| game-digital.webp | 게임/디지털 | 2 |
| fashion.webp | 패션 | 4 |

각 파일의 원본 출처, 권리자, 웹 공개·재배포 허용 범위와 필요한 출처 고지를 확인해야 한다. 기존 저장소에 있다는 사실이나 루트 Expo MIT LICENSE만으로 이미지별 권리를 확정하지 않는다.

확인 후 승인 파일만 `C:/dev/popku-rn/assets/images/categories/`에서 이 디렉터리로 복사하고, `shared/utils/placeInterests.ts`의 해당 `image`를 `/images/categories/파일명.webp`로 연결한다. 필요한 라이선스·출처 표기를 함께 보존한다.

현재는 중립 배경과 어두운 그라데이션으로 카테고리명을 표시한다. 실제 이미지가 연결되면 기존 컴포넌트의 크기 지정·cover·lazy loading을 사용하며 로딩 실패 시 같은 배경으로 돌아간다.
