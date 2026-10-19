// 노션 메인 페이지 Skills 6그룹 (직접 관리)
export const skills = [
    { group: 'Backend', items: ['Java', 'Spring Boot', 'JPA', 'MyBatis', 'Python', 'FastAPI', 'Celery', 'MapStruct'] },
    { group: 'Database', items: ['MySQL', 'MariaDB', 'Redis', 'Flyway', 'H2', '저장 프로시저', '행잠금(FOR UPDATE)'] },
    {
        group: '측정 · 검증',
        items: ['JUnit5', 'Mockito', 'jqwik', 'pytest', 'hypothesis', 'k6', 'Micrometer', 'Prometheus', 'Toxiproxy'],
    },
    { group: 'Infra', items: ['AWS (EC2)', 'Docker', 'Docker Compose', 'Jenkins', 'Nginx', 'MinIO'] },
    {
        group: 'STT · LLM',
        items: ['faster-whisper', 'WhisperLive', 'Silero VAD', 'Google STT', 'Ollama', 'LM Studio', 'Gemini'],
    },
    { group: 'Frontend', items: ['Next.js', 'TypeScript', 'MUI', 'AUIGrid', 'Zustand', 'TanStack Query', 'Zod'] },
] as const;
