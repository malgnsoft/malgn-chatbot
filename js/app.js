/**
 * App 모듈
 *
 * AI 튜터 맑은샘 - 메인 애플리케이션
 */

const App = {
  /**
   * 초기화
   */
  init() {
    console.log('AI 튜터 맑은샘 초기화...');

    this.bindElements();
    this.bindEvents();
    this.initModules();

    console.log('AI 튜터 맑은샘 준비 완료!');
  },

  /**
   * DOM 요소 바인딩
   */
  bindElements() {
    // 챗봇 열기/닫기
    this.openChatBtn = document.getElementById('openChatBtn');
    this.closeChatBtn = document.getElementById('closeChatBtn');
    this.chatbot = document.getElementById('chatbot');
    this.chatbotClose = document.getElementById('chatbotClose');
    this.chatFab = document.getElementById('chatFab');

    // 탭
    this.tabs = document.querySelectorAll('.nav-link[data-tab]');
    this.tabContents = document.querySelectorAll('.tab-content');

    // 탭 콘텐츠
    this.goalsText = document.getElementById('goalsText');
    this.summaryText = document.getElementById('summaryText');
    this.recommendText = document.getElementById('recommendText');
    this.quizText = document.getElementById('quizText');
  },

  /**
   * 이벤트 바인딩
   */
  bindEvents() {
    // 챗봇 열기
    this.openChatBtn.addEventListener('click', () => this.openChatbot());

    // 챗봇 닫기
    this.closeChatBtn.addEventListener('click', () => this.closeChatbot());
    this.chatbotClose.addEventListener('click', () => this.closeChatbot());

    // 플로팅 버튼 토글
    this.chatFab.addEventListener('click', () => this.toggleChatbot());

    // 탭 전환
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
  },

  /**
   * 모듈 초기화
   */
  initModules() {
    // Settings 먼저 초기화
    if (typeof Settings !== 'undefined') {
      Settings.init();
    }

    // Contents 초기화
    if (typeof Contents !== 'undefined') {
      Contents.init();
    }

    // Sessions 초기화
    if (typeof Sessions !== 'undefined') {
      Sessions.init();
    }

    // Chat 초기화
    if (typeof Chat !== 'undefined') {
      Chat.init();
    }
  },

  /**
   * 챗봇 열기
   */
  openChatbot() {
    this.chatbot.hidden = false;
    this.chatFab.classList.add('active');
  },

  /**
   * 챗봇 닫기
   */
  closeChatbot() {
    this.chatbot.hidden = true;
    this.chatFab.classList.remove('active');
  },

  /**
   * 챗봇 토글
   */
  toggleChatbot() {
    if (this.chatbot.hidden) {
      this.openChatbot();
    } else {
      this.closeChatbot();
    }
  },

  /**
   * 탭 전환
   */
  switchTab(tabName) {
    // 모든 탭 비활성화
    this.tabs.forEach(tab => tab.classList.remove('active'));
    this.tabContents.forEach(content => content.classList.remove('active'));

    // 선택된 탭 활성화
    document.querySelector(`.nav-link[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
  }
};

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// 전역으로 App 객체 노출
window.App = App;
