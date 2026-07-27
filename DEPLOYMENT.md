# FIDI 무료 자동 배포

`main` 브랜치에 push하면 GitHub Actions가 다음 순서로 실행됩니다.

1. 의존성 설치
2. 프로덕션 빌드와 서버 테스트
3. 실시간 데이터 API 키를 Cloudflare Worker Secret으로 반영
4. Cloudflare Workers에 배포

## 최초 1회 설정

GitHub 저장소의 `Settings → Secrets and variables → Actions`에서 다음 6개 Repository secret을 등록합니다.

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `ECOS_KEY`
- `FRED_KEY`
- `MASSIVE_API_KEY`
- `KRX_AUTH_KEY`

API 키는 저장소 파일이나 코드에 기록하지 않습니다. Cloudflare 배포 주소는 Worker 이름을 기준으로 생성되며, 현재 Sites 주소와는 별도의 주소가 될 수 있습니다.

