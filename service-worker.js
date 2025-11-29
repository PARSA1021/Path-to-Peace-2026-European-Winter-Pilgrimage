// 파일명: service-worker.js

// 캐시 버전 정의 (파일 변경 시 버전을 올려야 새 파일이 캐시됩니다.)
const CACHE_NAME = 'pilgrimage-guide-v2.1'; 

// PWA 작동에 필수적인 핵심 파일 목록
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/data.json',
    '/manifest.json',
    // 아이콘 경로도 캐시 목록에 추가 (예시)
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Service Worker 설치 이벤트: 캐시할 파일 추가 (Pre-caching)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] 필수 파일 캐싱 완료.');
                // 모든 필수 파일을 캐시에 추가합니다.
                return cache.addAll(urlsToCache).catch(err => {
                     // 아이콘 파일이 없을 경우에도 앱 실행에 문제 없도록 오류를 경고로 처리
                    console.warn('[Service Worker] 일부 파일 (아이콘 등) 캐싱 실패:', err);
                });
            })
    );
});

// Service Worker 활성화 이벤트: 이전 버전의 캐시 삭제
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // 현재 버전이 아닌 이전 캐시들을 모두 삭제합니다.
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('[Service Worker] 이전 캐시 삭제:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // 활성화 후 즉시 클라이언트 제어권을 확보하여 새로고침 없이 PWA 적용
    return self.clients.claim();
});

// Fetch 이벤트: 네트워크 요청 시 캐시 전략 적용 (Cache-First)
self.addEventListener('fetch', (event) => {
    // GET 요청에 대해서만 캐싱 전략 적용
    if (event.request.method !== 'GET') return;
    
    // Cache-First 전략: 캐시에 있으면 캐시에서 반환, 없으면 네트워크 요청
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // 1. 캐시에 일치하는 항목이 있으면 바로 반환 (오프라인 지원)
                if (response) {
                    return response;
                }
                
                // 2. 캐시에 없으면 네트워크로 요청
                return fetch(event.request)
                    .then((networkResponse) => {
                        // 유효한 응답 (HTTP 200)인 경우에만 캐시에 저장
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // 요청된 자원을 복제하여 캐시에 저장
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                // 이미지, CSS, JS 등 주요 자원만 런타임 캐싱
                                const url = event.request.url;
                                if (url.includes('.js') || url.includes('.css') || url.includes('.png') || url.includes('.json')) {
                                    cache.put(event.request, responseToCache);
                                }
                            });
                        
                        return networkResponse;
                    })
                    .catch(error => {
                        // 네트워크 요청 실패 시 (완전한 오프라인)
                        console.error('[Service Worker] Fetch 실패:', error);
                        // 오프라인 상태에서 요청 실패 시 반환할 대체 콘텐츠 없음 (핵심 파일은 이미 pre-cache됨)
                    });
            })
    );
});