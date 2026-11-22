# 온보딩 사용법 영상

온보딩 2단계 "영상으로 보는 사용법"에 나오는 영상입니다.

- `onboarding.mp4`: 사용법 영상(소리 없음, 38.7초). 원본(HEVC 1080×1920, 5.1MB)을 모든 브라우저에서 재생되도록 H.264 720×1280(2.1MB)으로 바꿨습니다.
- `onboarding.jpg`: 영상을 불러오는 동안 보이는 표지 그림(영상 첫 장면)

영상을 바꾸려면 같은 이름으로 덮어쓰면 됩니다. 아래 형식을 권장합니다.
- 형식: MP4(H.264), 세로 9:16, 소리 없음
- 크기: 10MB 이하
- 변환 예시: `ffmpeg -i 원본.mp4 -an -vf scale=720:-2 -c:v libx264 -crf 22 -pix_fmt yuv420p -movflags +faststart onboarding.mp4`

영상 대신 유튜브를 쓰려면 `index.html`의 `ONB_VIDEO`에 유튜브 주소를 넣으세요.
