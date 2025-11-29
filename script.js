/**
 * 파일명: script.js
 * 설명: 유럽 성지순례 가이드 애플리케이션의 핵심 로직 (PWA 오프라인 지원, 렌더링, 검색, UX/UI)
 */

// ==========================================================
// 1. 유틸리티 함수 (Utils)
// ==========================================================

/**
 * 디바운싱 헬퍼: 이벤트가 연속적으로 발생할 때, 마지막 이벤트 발생 후 일정 시간 뒤에만 함수를 실행합니다.
 * @param {function} func 실행할 함수
 * @param {number} delay 지연 시간 (밀리초)
 * @returns {function} 디바운싱된 함수
 */
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(null, args);
        }, delay);
    };
};

// ==========================================================
// 2. 검색 및 필터링 로직 (SearchManager Class)
// ==========================================================

class SearchManager {
    constructor(searchInputId, noResultsId) {
        this.searchInput = document.getElementById(searchInputId);
        // #no-results는 DOMContentLoaded에서 이미 생성되었음
        this.noResultsEl = document.getElementById(noResultsId);
        this.allSections = document.querySelectorAll('section');
        this.setupEventListeners();
        this.noResultsEl.style.display = 'none'; // 초기 숨김
    }

    /**
     * 이벤트 리스너 설정: 디바운싱을 적용하여 검색 실행
     */
    setupEventListeners() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', debounce((e) => {
                const query = e.target.value.trim().toLowerCase();
                this.performSearch(query);
            }, 300));
        }
    }

    /**
     * 실제 검색 로직 수행
     * @param {string} query 검색어 (소문자, 공백 제거됨)
     */
    performSearch(query) {
        // 검색 시작 시 초기화
        this.allSections.forEach(sec => sec.classList.remove('hidden'));
        this.noResultsEl.style.display = 'none';
        let totalResults = 0;

        // 검색어 없을 때 모든 항목 표시
        if (!query) {
            document.querySelectorAll('[data-search-content]').forEach(el => el.style.display = '');
            document.querySelector('#nav-menu').classList.remove('hidden');
            return;
        }

        // 모든 섹션을 순회하며 필터링
        this.allSections.forEach(section => {
            const items = section.querySelectorAll('[data-search-content], .itinerary-day-card');
            let sectionHasResults = false;

            items.forEach(el => {
                const searchContent = el.getAttribute('data-search-content') || el.closest('[data-search-content]')?.getAttribute('data-search-content') || el.textContent.toLowerCase();
                
                if (searchContent && searchContent.includes(query)) {
                    el.style.display = ''; // 일치 항목 표시
                    sectionHasResults = true;
                    totalResults++;

                    // 🌟 체크리스트 아코디언 자동 확장 로직
                    if (section.id === 'checklist') {
                        const checklistItem = el.closest('.checklist-item');
                        if (checklistItem) {
                            const header = checklistItem.querySelector('.checklist-header');
                            const content = checklistItem.querySelector('.checklist-content');
                            if (header && content && !content.classList.contains('open')) {
                                // DOM 조작으로 아코디언 펼침
                                content.classList.add('open');
                                header.setAttribute('aria-expanded', 'true');
                                header.querySelector('.toggle-icon').textContent = '−';
                            }
                        }
                    }
                    
                    // TODO: 하이라이팅을 하려면 innerHTML을 재구성해야 하므로 성능 이슈 때문에 여기서는 생략하고, CSS 하이라이팅 클래스만 유지합니다.

                } else {
                    el.style.display = 'none'; // 불일치 항목 숨김
                }
            });

            // 🌟 섹션 자체 숨기기 (해당 섹션에 결과가 하나도 없을 경우)
            if (items.length > 0) {
                if (!sectionHasResults) {
                    section.classList.add('hidden');
                } else {
                    section.classList.remove('hidden');
                }
            }
        });

        // 🌟 검색 결과 0건 안내
        if (totalResults === 0) {
            this.noResultsEl.style.display = 'block';
            document.querySelector('#nav-menu').classList.add('hidden'); // 검색 결과 없을 때 메뉴 숨김 (UX)
        } else {
            this.noResultsEl.style.display = 'none';
            document.querySelector('#nav-menu').classList.remove('hidden');
        }
    }
}

// ==========================================================
// 3. 렌더링 로직 (Renderer - HTML 템플릿 생성)
// ==========================================================

class Renderer {
    /**
     * 상세 일정 (Itinerary) 섹션을 렌더링합니다.
     * @param {Array} itineraryData data.json의 일정 데이터
     */
    static renderItinerary(itineraryData) {
        const itineraryDataEl = document.getElementById('itinerary-data');
        itineraryDataEl.innerHTML = itineraryData.map(day => {
            const memoType = day.memo.type;
            const memoClass = memoType === 'tip' ? 'memo-tip' : 'memo-caution';
            const memoTypeLabel = memoType === 'tip' ? '💡 TIP' : '⚠️ 주의';
            
            // 🌟 모든 검색 관련 텍스트를 하나의 data-search-content에 모음
            const searchContent = `day ${day.day} ${day.title} ${day.route} ${day.memo.content} ${day.items.map(i => i.detail).join(' ')}`.toLowerCase();

            return `
                <div class="itinerary-day-card" data-search-content="${searchContent}">
                    <div class="itinerary-header">
                        <span>DAY ${day.day}. ${day.title}</span>
                        <span>${day.date}</span>
                    </div>
                    <div class="itinerary-content">
                        <p class="itinerary-route">경로: ${day.route}</p>
                        ${day.items.map(item => `
                            <div class="itinerary-item">
                                <span class="time">${item.time}</span>
                                <span class="detail">${item.detail}</span>
                            </div>
                        `).join('')}
                        <div class="itinerary-memo ${memoClass}">
                            <strong>${memoTypeLabel}</strong>
                            <span>${day.memo.content}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 체크리스트 섹션을 렌더링하고 아코디언 이벤트를 설정합니다.
     * @param {Array} checklists data.json의 체크리스트 데이터
     */
    static renderChecklist(checklists) {
        const checklistDataEl = document.getElementById('checklist-data');
        checklistDataEl.innerHTML = checklists.map((list, index) => {
            // 🌟 모든 항목을 포함한 검색 문자열을 상위 요소에 저장
            const itemsSearchContent = list.items.join(' ').toLowerCase();
            const categorySearchContent = `${list.category} ${itemsSearchContent}`;

            return `
                <div class="checklist-item" data-search-content="${categorySearchContent}">
                    <button class="checklist-header" id="header-${index}" aria-expanded="false" aria-controls="content-${index}" role="button" tabindex="0">
                        ${list.icon} ${list.category}
                        <span class="toggle-icon" aria-hidden="true">+</span>
                    </button>
                    <div class="checklist-content" id="content-${index}" role="region" aria-labelledby="header-${index}">
                        <ul>
                            ${list.items.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }).join('');

        // 아코디언 이벤트 리스너 설정
        document.querySelectorAll('.checklist-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const content = document.getElementById(header.getAttribute('aria-controls'));
                const icon = header.querySelector('.toggle-icon');
                const isOpen = content.classList.contains('open');

                // UX 개선: 다른 아코디언 닫기 로직 (하나만 열리도록)
                document.querySelectorAll('.checklist-content.open').forEach(openContent => {
                    if (openContent.id !== content.id) {
                        openContent.classList.remove('open');
                        openContent.previousElementSibling.setAttribute('aria-expanded', 'false');
                        openContent.previousElementSibling.querySelector('.toggle-icon').textContent = '+';
                    }
                });

                // 토글
                content.classList.toggle('open');
                header.setAttribute('aria-expanded', !isOpen);
                icon.textContent = !isOpen ? '−' : '+';
            });
            // 키보드 접근성 처리
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    header.click();
                }
            });
        });
    }

    /**
     * 기타 간단한 섹션을 렌더링합니다.
     * @param {Object} data 전체 데이터 객체
     */
    static renderSimpleSections(data) {
        // 핵심 일정
        document.getElementById('schedule-data').innerHTML = `
            <div class="label" data-search-content="모이는 날">모이는 날</div><div class="value">${data.dates.meeting}</div>
            <div class="label" data-search-content="모이는 장소">모이는 장소</div><div class="value">${data.location.meeting}</div>
            <div class="label" data-search-content="출국 일시">출국 일시</div><div class="value">${data.dates.departure}</div>
            <div class="label" data-search-content="귀국 일시">귀국 일시</div><div class="value">${data.dates.return}</div>
            <div class="note" data-search-content="${data.location.notes.toLowerCase()}">※ ${data.location.notes}</div>
        `;

        // 비용 안내
        document.getElementById('cost-data').innerHTML = data.costs.map(cost => `
            <div data-search-content="${cost.item.toLowerCase()} ${cost.note.toLowerCase()} ${cost.amount}">
                <strong>${cost.item}: ${cost.amount}</strong>
                <span>${cost.note}</span>
            </div>
        `).join('');

        // 수하물
        document.getElementById('luggage-data').innerHTML = `
            <div data-search-content="수하물 무게 제한 ${data.luggage.max_weight} 돌아올 때 짐">
                <strong>수하물 무게 제한: ${data.luggage.max_weight}</strong>
                <span>(돌아올 때 짐 증가 고려하여 가볍게 싸세요!)</span>
            </div>
            <div data-search-content="보조 가방 백팩 기내용 ${data.luggage.carry_on}">
                <strong>보조 가방: ${data.luggage.carry_on}</strong>
                <span>(무게 초과 시 분산용, 일상용)</span>
            </div>
            <div data-search-content="현지 소매치기 안전 ${data.luggage.safety}">
                <strong>현지 이동: ${data.luggage.safety}</strong>
                <span>(소매치기 위험으로 안전을 위해 몸 앞에 착용)</span>
            </div>
        `;

        // 날씨
        document.getElementById('weather-data').innerHTML = data.weather.map(w => `
            <div class="weather-item" data-search-content="${w.location.toLowerCase()} ${w.notes.toLowerCase()} ${w.temp.toLowerCase()}">
                <strong>${w.icon} ${w.location}</strong>
                <div class="temp">평균 온도: ${w.temp}</div>
                <div class="notes">팁: ${w.notes}</div>
            </div>
        `).join('');
        
        // 연락망
        document.getElementById('contact-data').innerHTML = data.contacts.map(c => `
            <div data-search-content="${c.name.toLowerCase()} ${c.phone}">
                <strong>${c.name}</strong>
                <span><a href="tel:${c.phone.replace(/-/g, '')}" aria-label="${c.name}에게 전화걸기">${c.phone}</a></span>
            </div>
        `).join('');
        document.getElementById('contact-note').textContent = data.contact_note;
    }
}

// ==========================================================
// 4. 애플리케이션 메인 (App Class)
// ==========================================================

class App {
    constructor() {
        this.loading = document.getElementById('loading');
        this.themeToggle = document.getElementById('theme-toggle');
    }

    /**
     * 애플리케이션을 초기화하고 데이터를 로드합니다. (PWA 오프라인 로직 포함)
     */
    async init() {
        let data = null;

        try {
            // 1. 네트워크에서 데이터 fetch 시도
            const response = await fetch('data.json');
            if (!response.ok) throw new Error('네트워크 데이터 로드 실패');
            data = await response.json();
            
            // 🌟 PWA 개선: 성공적으로 로드된 데이터를 로컬 스토리지에 캐시
            localStorage.setItem('appData', JSON.stringify(data));
            console.log('데이터를 로컬 스토리지에 캐시했습니다.');

        } catch (error) {
            console.error('네트워크 로드 오류:', error.message);
            this.loading.textContent = '데이터를 로딩 중입니다... (오프라인 모드 시도)';

            // 2. 🌟 PWA 개선: 네트워크 실패 시 로컬 스토리지에서 데이터 로드 시도
            const cachedData = localStorage.getItem('appData');
            if (cachedData) {
                data = JSON.parse(cachedData);
                console.log('로컬 스토리지에서 오프라인 데이터 로드 성공.');
                this.loading.textContent = '오프라인 데이터로 로드되었습니다.';
                setTimeout(() => this.loading.style.display = 'none', 1000); // 1초 후 숨김
            } else {
                console.error('로컬 스토리지에도 데이터 없음. 앱 실행 불가.');
                this.loading.textContent = '앱 실행에 필요한 데이터를 로드할 수 없습니다. 인터넷 연결 후 다시 시도해 주세요.';
                return; // 데이터 없으면 앱 실행 중지
            }
        }

        // 데이터가 성공적으로 로드(네트워크 또는 캐시)된 경우
        if (data) {
            this.renderAll(data);
            this.setupThemeToggle();
            this.setupSmoothScroll();

            // 검색 관리자 초기화 (렌더링 후 DOM 준비 완료 시점)
            new SearchManager('search-input', 'no-results');

            // 로딩 화면 숨김
            this.loading.style.display = 'none';
        }
    }

    /**
     * 모든 섹션 데이터를 렌더링합니다.
     * @param {Object} data data.json 객체
     */
    renderAll(data) {
        document.getElementById('app-subtitle').textContent = 
            `${data.dates.departure.split('(')[0].trim()} 출발`;

        Renderer.renderSimpleSections(data);
        Renderer.renderItinerary(data.itinerary);
        Renderer.renderChecklist(data.checklists);
    }

    /**
     * 다크 모드 토글 기능을 설정합니다.
     */
    setupThemeToggle() {
        const currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', currentTheme);
        this.themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
        this.themeToggle.setAttribute('aria-label', currentTheme === 'dark' ? '라이트 모드' : '다크 모드');

        this.themeToggle.addEventListener('click', () => {
            const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            this.themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
            this.themeToggle.setAttribute('aria-label', newTheme === 'dark' ? '라이트 모드' : '다크 모드');
        });
    }

    /**
     * 네비게이션 스무스 스크롤을 설정합니다.
     */
    setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                // 네비게이션 스틱 상태를 고려하여 스크롤 위치 조정
                const targetId = this.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                const navHeight = document.getElementById('nav-menu').offsetHeight;
                const offsetTop = targetElement.offsetTop - navHeight;

                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            });
        });
    }
}

// ==========================================================
// 5. 초기화
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    // 🌟 UX 개선: 검색 결과 없음 메시지 DOM 미리 생성
    const mainEl = document.querySelector('main');
    const searchContainer = document.getElementById('search-container');
    if (mainEl && searchContainer) {
        const noResultsEl = document.createElement('div');
        noResultsEl.id = 'no-results';
        noResultsEl.textContent = '일치하는 검색 결과가 없습니다.';
        noResultsEl.style.cssText = 'padding: 20px; text-align: center; font-weight: bold; color: var(--danger-color);';
        // 검색 컨테이너 바로 아래에 위치
        mainEl.insertBefore(noResultsEl, searchContainer.nextSibling);
    }
    
    new App().init();
});