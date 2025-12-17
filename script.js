/**
 * 유럽 성지순례 가이드 - 최적화 버전
 * 간소화되고 빠른 성능, 유지보수 용이
 */

// ========================================================
// 1. 설정
// ========================================================

const CONFIG = {
    SEARCH_DEBOUNCE_DELAY: 300,
    MAX_SEARCH_HISTORY: 5,
    SCROLL_OFFSET: 150,
    TOUCH_DELAY: 100,
    SCROLL_THROTTLE: 100,
    IS_MOBILE: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    IS_TOUCH: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
};

const SEARCH_SYNONYMS = {
    '파리': ['파리', '에펠탑', '루브르'],
    '스위스': ['스위스', '융프라우'],
    '이탈리아': ['이탈리아', '로마'],
    '항공': ['항공', '출발', '도착'],
    '날씨': ['날씨', '옷', '패딩'],
    '준비물': ['준비물', '짐', '여권'],
    '비용': ['비용', '회비', '유로'],
};

// ========================================================
// 2. 유틸리티 함수
// ========================================================

const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            try {
                func.apply(null, args);
            } catch (error) {
                console.error('오류:', error);
            }
        }, delay);
    };
};

const throttle = (func, delay) => {
    let lastCall = 0;
    return (...args) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            try {
                func.apply(null, args);
            } catch (error) {
                console.error('오류:', error);
            }
        }
    };
};

// 모바일 터치 이벤트 최적화
const addTouchOptimizedListener = (element, event, handler, options = {}) => {
    if (CONFIG.IS_TOUCH && event === 'click') {
        let touchStartTime = 0;
        let touchStartX = 0;
        let touchStartY = 0;
        
        element.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        element.addEventListener('touchend', (e) => {
            const touchEndTime = Date.now();
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const timeDiff = touchEndTime - touchStartTime;
            const xDiff = Math.abs(touchEndX - touchStartX);
            const yDiff = Math.abs(touchEndY - touchStartY);
            
            // 빠른 터치이고 이동 거리가 작으면 클릭으로 처리
            if (timeDiff < CONFIG.TOUCH_DELAY && xDiff < 10 && yDiff < 10) {
                e.preventDefault();
                handler(e);
            }
        }, { passive: false });
    } else {
        element.addEventListener(event, handler, options);
    }
};

const safeStorage = {
    getItem: (key, defaultValue = null) => {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    },
    setItem: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    }
};

const updateActiveNav = throttle(() => {
    try {
        const sections = document.querySelectorAll('main > section:not(.hidden)');
        const navLinks = document.querySelectorAll('.sticky-nav a');
        
        let currentIndex = 0;
        const scrollOffset = CONFIG.IS_MOBILE ? 100 : CONFIG.SCROLL_OFFSET;
        
        sections.forEach((section, index) => {
            const rect = section.getBoundingClientRect();
            if (rect.top <= scrollOffset && rect.bottom >= scrollOffset) {
                currentIndex = index;
            }
        });

        navLinks.forEach(link => link.classList.remove('active'));
        if (navLinks[currentIndex]) {
            navLinks[currentIndex].classList.add('active');
        }
    } catch (error) {
        console.warn('네비게이션 업데이트 오류:', error);
    }
}, CONFIG.SCROLL_THROTTLE);

const expandSearchQuery = (query) => {
    if (!query || query.length < 2) return [query];
    
    let expandedTerms = new Set([query.toLowerCase()]);
    
    for (const [key, synonyms] of Object.entries(SEARCH_SYNONYMS)) {
        if (synonyms.some(syn => query.toLowerCase().includes(syn.toLowerCase()))) {
            synonyms.forEach(syn => expandedTerms.add(syn.toLowerCase()));
        }
    }
    
    return Array.from(expandedTerms);
};

// ========================================================
// 3. 검색 매니저 (간소화)
// ========================================================

class SearchManager {
    constructor(searchInputId) {
        this.searchInput = document.getElementById(searchInputId);
        this.allSections = document.querySelectorAll('main > section');
        this.currentQuery = '';
        this.searchHistory = safeStorage.getItem('searchHistory', []);
        
        this.setupEventListeners();
        this.createSearchUI();
    }

    setupEventListeners() {
        if (!this.searchInput) return;

        this.searchInput.addEventListener('input', debounce((e) => {
            const query = e.target.value.trim().toLowerCase();
            this.currentQuery = query;
            
            if (query.length >= 2) {
                this.showRecentSearches(query);
                this.performSearch(query);
            } else {
                this.resetSearch();
                this.hideHistorySuggestions();
            }
        }, CONFIG.SEARCH_DEBOUNCE_DELAY));

        this.searchInput.addEventListener('focus', () => {
            if (!this.searchInput.value && this.searchHistory.length > 0) {
                this.showRecentSearches('');
            }
        });

        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = this.searchInput.value.trim();
                if (query.length >= 2) {
                    this.saveSearchHistory(query);
                }
            }
            if (e.key === 'Escape') {
                this.hideHistorySuggestions();
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#search-container')) {
                this.hideHistorySuggestions();
            }
        });
    }

    createSearchUI() {
        const container = document.getElementById('search-container');
        if (!container) return;

        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = 'search-suggestions';
        suggestionsDiv.className = 'search-suggestions hidden';
        container.appendChild(suggestionsDiv);
    }

    showRecentSearches(query) {
        const suggestionsDiv = document.getElementById('search-suggestions');
        
        let matchingHistory = this.searchHistory;
        if (query) {
            matchingHistory = this.searchHistory.filter(item =>
                item.toLowerCase().includes(query)
            );
        }

        if (matchingHistory.length === 0) {
            this.hideHistorySuggestions();
            return;
        }

        let html = `<div class="suggestions-content">
                        <div class="suggestion-group">
                            <div class="suggestion-title">⏰ 최근 검색</div>`;
        
        matchingHistory.slice(0, 5).forEach(item => {
            html += `<div class="suggestion-item" data-query="${item}">${item}</div>`;
        });

        if (this.searchHistory.length > 0) {
            html += `<button id="clear-history" class="clear-history-btn" type="button">
                        🗑️ 삭제
                     </button>`;
        }
        
        html += '</div></div>';

        suggestionsDiv.innerHTML = html;
        suggestionsDiv.classList.remove('hidden');

        document.querySelectorAll('.suggestion-item').forEach(item => {
            addTouchOptimizedListener(item, 'click', () => {
                const query = item.getAttribute('data-query');
                this.searchInput.value = query;
                this.performSearch(query);
                this.hideHistorySuggestions();
            });
        });

        const clearBtn = document.getElementById('clear-history');
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.searchHistory = [];
                safeStorage.setItem('searchHistory', []);
                this.hideHistorySuggestions();
            });
        }
    }

    hideHistorySuggestions() {
        const suggestionsDiv = document.getElementById('search-suggestions');
        if (suggestionsDiv) {
            suggestionsDiv.classList.add('hidden');
        }
    }

    performSearch(query) {
        if (!query || query.length < 2) {
            this.resetSearch();
            return;
        }

        const expandedTerms = expandSearchQuery(query);
        let totalResults = 0;

        this.allSections.forEach(section => {
            const items = section.querySelectorAll('[data-search-content], .itinerary-day-card');
            let sectionHasResults = false;

            items.forEach(item => {
                const content = (item.getAttribute('data-search-content') || item.textContent).toLowerCase();
                const isMatch = expandedTerms.some(term => content.includes(term) && term.length > 0);
                
                item.style.display = isMatch ? '' : 'none';
                
                if (isMatch) {
                    sectionHasResults = true;
                    totalResults++;
                    
                    // 체크리스트 자동 확장
                    if (section.id === 'checklist') {
                        const checklistItem = item.closest('.checklist-item');
                        if (checklistItem) {
                            const header = checklistItem.querySelector('.checklist-header');
                            const content = checklistItem.querySelector('.checklist-content');
                            if (header && content && !content.classList.contains('open')) {
                                content.classList.add('open');
                                header.setAttribute('aria-expanded', 'true');
                                header.querySelector('.toggle-icon').textContent = '−';
                            }
                        }
                    }
                }
            });

            section.classList.toggle('hidden', !sectionHasResults && items.length > 0);
        });
    }

    resetSearch() {
        this.allSections.forEach(section => {
            section.classList.remove('hidden');
            section.querySelectorAll('[data-search-content], .itinerary-day-card').forEach(item => {
                item.style.display = '';
            });
        });
    }

    saveSearchHistory(query) {
        if (!query.trim() || query.length < 2) return;
        
        this.searchHistory = this.searchHistory.filter(item => item !== query);
        this.searchHistory.unshift(query);
        this.searchHistory = this.searchHistory.slice(0, CONFIG.MAX_SEARCH_HISTORY);
        
        safeStorage.setItem('searchHistory', this.searchHistory);
    }
}

// ========================================================
// 4. 렌더링
// ========================================================

class Renderer {
    static renderItinerary(itineraryData) {
        const itineraryDataEl = document.getElementById('itinerary-data');
        if (!itineraryDataEl) return;

        itineraryDataEl.innerHTML = itineraryData.map(day => {
            const memoType = day.memo.type;
            const memoIcon = memoType === 'tip' ? '💡' : '⚠️';
            const memoLabel = memoType === 'tip' ? 'TIP' : '주의';
            const searchContent = `${day.title} ${day.route} ${day.date} ${day.items.map(i => i.detail).join(' ')}`.toLowerCase();

            return `
                <div class="itinerary-day-card" data-search-content="${searchContent}">
                    <div class="itinerary-header">
                        <span>DAY ${day.day}. ${day.title}</span>
                        <span>${day.date}</span>
                    </div>
                    <div class="itinerary-content">
                        <p class="itinerary-route">📍 ${day.route}</p>
                        ${day.items.map(item => `
                            <div class="itinerary-item">
                                <span class="time">🕐 ${item.time}</span>
                                <span class="detail">${item.detail}</span>
                            </div>
                        `).join('')}
                        <div class="itinerary-memo memo-${memoType}">
                            <strong>${memoIcon} ${memoLabel}</strong>
                            <span>${day.memo.content}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    static renderChecklist(checklists) {
        const checklistDataEl = document.getElementById('checklist-data');
        if (!checklistDataEl) return;

        checklistDataEl.innerHTML = checklists.map((list, index) => {
            const categorySearchContent = `${list.category} ${list.items.join(' ')}`.toLowerCase();

            return `
                <div class="checklist-item" data-search-content="${categorySearchContent}">
                    <button class="checklist-header" 
                            id="header-${index}" 
                            aria-expanded="false" 
                            aria-controls="content-${index}"
                            type="button">
                        ${list.icon} ${list.category}
                        <span class="toggle-icon" aria-hidden="true">+</span>
                    </button>
                    <div class="checklist-content" id="content-${index}">
                        <ul>
                            ${list.items.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.checklist-header').forEach(header => {
            addTouchOptimizedListener(header, 'click', () => this.toggleChecklist(header));
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleChecklist(header);
                }
            });
        });
    }

    static toggleChecklist(header) {
        const content = document.getElementById(header.getAttribute('aria-controls'));
        const icon = header.querySelector('.toggle-icon');
        const isOpen = content.classList.contains('open');

        document.querySelectorAll('.checklist-content.open').forEach(openContent => {
            if (openContent !== content) {
                openContent.classList.remove('open');
                openContent.previousElementSibling.setAttribute('aria-expanded', 'false');
                openContent.previousElementSibling.querySelector('.toggle-icon').textContent = '+';
            }
        });

        content.classList.toggle('open');
        header.setAttribute('aria-expanded', !isOpen);
        icon.textContent = !isOpen ? '−' : '+';
    }

    static renderSimpleSections(data) {
        const elements = {
            schedule: 'schedule-data',
            cost: 'cost-data',
            luggage: 'luggage-data',
            weather: 'weather-data',
            contact: 'contact-data'
        };

        const scheduleEl = document.getElementById(elements.schedule);
        if (scheduleEl) {
            scheduleEl.innerHTML = `
                <div class="label" data-search-content="모이는 날">📅 모이는 날</div>
                <div class="value">${data.dates.meeting}</div>
                <div class="label" data-search-content="모이는 장소">📍 모이는 장소</div>
                <div class="value">${data.location.meeting}</div>
                <div class="label" data-search-content="출국">🛫 출국</div>
                <div class="value">${data.dates.departure}</div>
                <div class="label" data-search-content="귀국">🛬 귀국</div>
                <div class="value">${data.dates.return}</div>
                <div class="note" data-search-content="${data.location.notes.toLowerCase()}">
                    ⚠️ ${data.location.notes}
                </div>
            `;
        }

        const costEl = document.getElementById(elements.cost);
        if (costEl) {
            costEl.innerHTML = data.costs.map(cost => `
                <div data-search-content="${cost.item.toLowerCase()} ${cost.amount}">
                    <strong>💰 ${cost.item}</strong>
                    <span>${cost.amount} - ${cost.note}</span>
                </div>
            `).join('');
        }

        const luggageEl = document.getElementById(elements.luggage);
        if (luggageEl) {
            luggageEl.innerHTML = `
                <div data-search-content="무게">
                    <strong>⚖️ 수하물 무게</strong>
                    <span>${data.luggage.max_weight}</span>
                </div>
                <div data-search-content="백팩">
                    <strong>🎒 보조 가방</strong>
                    <span>${data.luggage.carry_on}</span>
                </div>
                <div data-search-content="안전">
                    <strong>🔒 현지 안전</strong>
                    <span>${data.luggage.safety}</span>
                </div>
            `;
        }

        const weatherEl = document.getElementById(elements.weather);
        if (weatherEl) {
            weatherEl.innerHTML = data.weather.map(w => `
                <div class="weather-item" data-search-content="${w.location.toLowerCase()} ${w.temp}">
                    <strong>${w.icon} ${w.location}</strong>
                    <div class="temp">🌡️ ${w.temp}</div>
                    <div class="notes">${w.notes}</div>
                </div>
            `).join('');
        }

        const contactEl = document.getElementById(elements.contact);
        if (contactEl) {
            contactEl.innerHTML = data.contacts.map(c => `
                <div data-search-content="${c.name.toLowerCase()} ${c.phone}">
                    <strong>☎️ ${c.name}</strong>
                    <span><a href="tel:${c.phone.replace(/-/g, '')}">${c.phone}</a></span>
                </div>
            `).join('');
        }

        const contactNoteEl = document.getElementById('contact-note');
        if (contactNoteEl) {
            contactNoteEl.textContent = `📱 ${data.contact_note}`;
        }
    }
}

// ========================================================
// 5. 메인 애플리케이션
// ========================================================

class App {
    constructor() {
        this.loading = document.getElementById('loading');
        this.themeToggle = document.getElementById('theme-toggle');
    }

    async init() {
        let data = null;

        try {
            const response = await fetch('data.json', { cache: 'force-cache' });
            if (!response.ok) throw new Error('네트워크 오류');
            data = await response.json();
            safeStorage.setItem('appData', data);
        } catch (error) {
            data = safeStorage.getItem('appData');
            if (data && this.loading) {
                this.loading.textContent = '오프라인 모드';
                setTimeout(() => {
                    if (this.loading) this.loading.style.display = 'none';
                }, 2000);
            } else {
                if (this.loading) {
                    this.loading.textContent = '⚠️ 데이터를 불러올 수 없습니다.';
                }
                return;
            }
        }

        if (data) {
            try {
                this.renderAll(data);
                this.setupTheme();
                this.setupScroll();
                this.setupMobileMenu();
                this.setupOfflineIndicator();
                new SearchManager('search-input');
                
                if (this.loading) {
                    this.loading.style.display = 'none';
                }
            } catch (error) {
                console.error('초기화 오류:', error);
            }
        }
    }

    renderAll(data) {
        const subtitle = document.getElementById('app-subtitle');
        if (subtitle) {
            subtitle.textContent = `${data.dates.departure.split('(')[0].trim()} 출발 🌍`;
        }

        Renderer.renderSimpleSections(data);
        Renderer.renderItinerary(data.itinerary);
        Renderer.renderChecklist(data.checklists);
    }

    setupTheme() {
        const currentTheme = safeStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);
        this.updateThemeIcon(currentTheme);

        if (this.themeToggle) {
            addTouchOptimizedListener(this.themeToggle, 'click', () => {
                const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', newTheme);
                safeStorage.setItem('theme', newTheme);
                this.updateThemeIcon(newTheme);
            });
        }
    }

    updateThemeIcon(theme) {
        if (this.themeToggle) {
            this.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
            this.themeToggle.setAttribute('aria-label', `${theme === 'dark' ? '라이트' : '다크'} 모드`);
        }
    }

    setupScroll() {
        document.querySelectorAll('.sticky-nav a').forEach(link => {
            addTouchOptimizedListener(link, 'click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const target = document.querySelector(targetId);
                
                // 모바일 메뉴 닫기
                this.closeMobileMenu();
                
                if (target) {
                    const navHeight = document.querySelector('.sticky-nav')?.offsetHeight || 0;
                    const scrollOffset = CONFIG.IS_MOBILE ? 100 : CONFIG.SCROLL_OFFSET;
                    const offsetTop = target.offsetTop - navHeight - scrollOffset;

                    window.scrollTo({
                        top: Math.max(0, offsetTop),
                        behavior: 'smooth'
                    });
                }
            });
        });

        window.addEventListener('scroll', updateActiveNav, { passive: true });
        
        // 모바일에서 스크롤 성능 최적화
        if (CONFIG.IS_MOBILE) {
            let ticking = false;
            const optimizedScroll = () => {
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        updateActiveNav();
                        this.updateBackToTop();
                        ticking = false;
                    });
                    ticking = true;
                }
            };
            window.removeEventListener('scroll', updateActiveNav);
            window.addEventListener('scroll', optimizedScroll, { passive: true });
        } else {
            window.addEventListener('scroll', () => this.updateBackToTop(), { passive: true });
        }
        
        // 백투탑 버튼 설정
        this.setupBackToTop();
    }
    
    setupMobileMenu() {
        const menuToggle = document.getElementById('mobile-menu-toggle');
        const navList = document.getElementById('nav-list');
        
        if (menuToggle && navList) {
            addTouchOptimizedListener(menuToggle, 'click', () => {
                const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
                menuToggle.setAttribute('aria-expanded', !isOpen);
                navList.classList.toggle('menu-open');
                
                // 바디 스크롤 잠금/해제
                if (!isOpen) {
                    document.body.style.overflow = 'hidden';
                } else {
                    document.body.style.overflow = '';
                }
            });
            
            // 외부 클릭 시 메뉴 닫기
            document.addEventListener('click', (e) => {
                if (!menuToggle.contains(e.target) && !navList.contains(e.target)) {
                    this.closeMobileMenu();
                }
            });
        }
    }
    
    closeMobileMenu() {
        const menuToggle = document.getElementById('mobile-menu-toggle');
        const navList = document.getElementById('nav-list');
        
        if (menuToggle && navList) {
            menuToggle.setAttribute('aria-expanded', 'false');
            navList.classList.remove('menu-open');
            document.body.style.overflow = '';
        }
    }
    
    setupBackToTop() {
        const backToTop = document.getElementById('back-to-top');
        
        if (backToTop) {
            addTouchOptimizedListener(backToTop, 'click', () => {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
        }
    }
    
    updateBackToTop() {
        const backToTop = document.getElementById('back-to-top');
        if (backToTop) {
            if (window.scrollY > 300) {
                backToTop.classList.add('visible');
            } else {
                backToTop.classList.remove('visible');
            }
        }
    }
    
    setupOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        
        if (indicator) {
            window.addEventListener('online', () => {
                indicator.classList.add('hidden');
            });
            
            window.addEventListener('offline', () => {
                indicator.classList.remove('hidden');
            });
            
            // 초기 상태 확인
            if (!navigator.onLine) {
                indicator.classList.remove('hidden');
            }
        }
    }
}

// ========================================================
// 6. 초기화
// ========================================================

// 성능 최적화: 이미지 지연 로딩 및 리소스 최적화
const optimizePerformance = () => {
    // Intersection Observer로 지연 로딩 (필요시)
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('loaded');
                }
            });
        }, { rootMargin: '50px' });
        
        document.querySelectorAll('.lazy-load').forEach(el => observer.observe(el));
    }
    
    // 모바일에서 불필요한 애니메이션 줄이기
    if (CONFIG.IS_MOBILE && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.documentElement.style.setProperty('--md-motion-short3', '0ms');
        document.documentElement.style.setProperty('--md-motion-medium2', '0ms');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    try {
        optimizePerformance();
        new App().init();

        // PWA Service Worker 등록
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(reg => console.log('Service Worker 등록 성공:', reg.scope))
                    .catch(err => console.log('Service Worker 등록 실패:', err));
            });
        }
        
        // 오프라인 감지
        window.addEventListener('online', () => {
            console.log('온라인 상태로 전환');
        });
        
        window.addEventListener('offline', () => {
            console.log('오프라인 상태로 전환');
        });
    } catch (error) {
        console.error('초기화 오류:', error);
    }
});