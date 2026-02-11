(()=>{var r=(o,t)=>()=>(o&&(t=o(o=0)),t);var T=(o,t)=>()=>(t||o((t={exports:{}}).exports,t),t.exports);var m,I=r(()=>{m=class{constructor(t,s){this.baseUrl=t,this.apiKey=s}getHeaders(t=!0){let s={};return this.apiKey&&(s.Authorization=`Bearer ${this.apiKey}`),t&&(s["Content-Type"]="application/json"),s}async handleResponse(t){if(t.status===401)throw new Error("API Key\uAC00 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");if(!t.ok){let s=await t.json().catch(()=>({}));throw new Error(s.error?.message||"\uC694\uCCAD \uC2E4\uD328")}return t.json()}async createSession(t,s={}){let e={content_ids:t};s.courseId&&(e.course_id=s.courseId),s.courseUserId&&(e.course_user_id=s.courseUserId),s.lessonId&&(e.lesson_id=s.lessonId),s.settings&&(e.settings=s.settings);let n=await fetch(`${this.baseUrl}/sessions`,{method:"POST",headers:this.getHeaders(),body:JSON.stringify(e)});return this.handleResponse(n)}async getSession(t){let s=await fetch(`${this.baseUrl}/sessions/${t}`,{headers:this.getHeaders(!1)});return this.handleResponse(s)}async sendMessage(t,s,e={}){let n=await fetch(`${this.baseUrl}/chat`,{method:"POST",headers:this.getHeaders(),body:JSON.stringify({message:t,sessionId:s,settings:e})});return this.handleResponse(n)}async getQuizzes(t){let s=await fetch(`${this.baseUrl}/sessions/${t}/quizzes`,{headers:this.getHeaders(!1)});return this.handleResponse(s)}}});var h,E=r(()=>{h={chatbot:null,fab:null,inject(o){let t=o.width||380,s=o.height||650,e=document.createElement("button");e.id="malgn-fab",e.className="chat-fab",e.title="\uCC44\uD305 \uC5F4\uAE30",e.innerHTML=`
      <i class="bi bi-chat-dots-fill chat-fab-icon"></i>
      <i class="bi bi-x-lg chat-fab-close"></i>
    `,document.body.appendChild(e),this.fab=e;let n=document.createElement("div");n.id="malgn-chatbot",n.className="chatbot",n.hidden=!0,n.style.width=t+"px",n.style.height=s+"px",n.innerHTML=`
      <!-- Header -->
      <div class="chatbot-header">
        <span class="chatbot-title">
          <i class="bi bi-mortarboard-fill chatbot-title-icon"></i>
          AI \uD29C\uD130 \uB9D1\uC740\uC0D8
        </span>
        <button class="chatbot-close" id="malgn-close">
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <!-- Tabs -->
      <div class="chatbot-tabs">
        <button class="chatbot-tab active" data-tab="goals">\uBAA9\uD45C</button>
        <button class="chatbot-tab" data-tab="summary">\uC694\uC57D</button>
        <button class="chatbot-tab" data-tab="recommend">\uCD94\uCC9C</button>
        <button class="chatbot-tab" data-tab="quiz">\uD034\uC988</button>
      </div>

      <!-- Scrollable Body -->
      <div class="chatbot-body" id="malgn-body">
        <!-- Tab Content -->
        <div class="chatbot-content">
          <div class="malgn-tab-content active" id="malgn-tab-goals">
            <h6>
              <i class="bi bi-stars"></i> \uD559\uC2B5\uBAA9\uD45C
            </h6>
            <div id="malgn-goals-text">\uD559\uC2B5 \uBAA9\uD45C\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.</div>
          </div>
          <div class="malgn-tab-content" id="malgn-tab-summary">
            <h6>
              <i class="bi bi-journal-text"></i> \uC694\uC57D
            </h6>
            <div id="malgn-summary-text">\uC694\uC57D\uC774 \uC0DD\uC131\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.</div>
          </div>
          <div class="malgn-tab-content" id="malgn-tab-recommend">
            <h6>
              <i class="bi bi-chat-left-quote"></i> \uCD94\uCC9C\uC9C8\uBB38
            </h6>
            <div id="malgn-recommend-text">\uCD94\uCC9C \uC9C8\uBB38\uC774 \uC0DD\uC131\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.</div>
          </div>
          <div class="malgn-tab-content" id="malgn-tab-quiz">
            <h6>
              <i class="bi bi-patch-question"></i> \uD034\uC988
            </h6>
            <div id="malgn-quiz-text">\uD034\uC988\uAC00 \uC0DD\uC131\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.</div>
          </div>
        </div>

        <!-- Chat Messages -->
        <div class="chatbot-messages" id="malgn-messages">
          <div class="chatbot-msg chatbot-msg--assistant">
            <div class="chatbot-msg-content">
              \uC548\uB155\uD558\uC138\uC694! AI \uD29C\uD130\uC785\uB2C8\uB2E4. \uAD81\uAE08\uD55C \uC810\uC774 \uC788\uC73C\uBA74 \uC5B8\uC81C\uB4E0 \uBB3C\uC5B4\uBCF4\uC138\uC694!
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Input -->
      <div class="chatbot-footer">
        <input type="text" class="chatbot-input" id="malgn-input" placeholder="\uBA54\uC2DC\uC9C0\uB97C \uC785\uB825\uD558\uC138\uC694">
        <button class="chatbot-send" id="malgn-send">
          <i class="bi bi-send-fill"></i>
        </button>
      </div>
    `,document.body.appendChild(n),this.chatbot=n},open(){this.chatbot&&(this.chatbot.hidden=!1),this.fab&&this.fab.classList.add("active")},setFabLoading(o){this.fab&&(o?this.fab.classList.add("loading"):this.fab.classList.remove("loading"))},close(){console.log("[MalgnTutor] UI.close() called",this.chatbot,this.fab),this.chatbot&&(this.chatbot.hidden=!0,console.log("[MalgnTutor] chatbot.hidden set to true")),this.fab&&this.fab.classList.remove("active")},toggle(){this.chatbot&&this.chatbot.hidden?this.open():this.close()}}});function d(o){let t=document.createElement("div");return t.textContent=o,t.innerHTML}function q(o){return d(o).replace(/\n/g,"<br>")}var g=r(()=>{});var b,x=r(()=>{g();b=class{constructor(t,s){this.api=t,this.config=s,this.sessionId=null,this.isLoading=!1,this.onSessionCreating=null,this.onSessionCreated=null}init(){this.messagesEl=document.getElementById("malgn-messages"),this.inputEl=document.getElementById("malgn-input"),this.sendBtn=document.getElementById("malgn-send"),this.sendBtn.addEventListener("click",()=>this.sendMessage()),this.inputEl.addEventListener("keydown",t=>{t.key==="Enter"&&!t.shiftKey&&(t.preventDefault(),this.sendMessage())}),this.inputEl.addEventListener("focus",()=>this.scrollToBottom())}async loadSession(t){this.sessionId=t;try{let s=await this.api.getSession(t);s.success&&(this.clearMessages(),(s.data.messages||[]).forEach(n=>{n.role==="user"?this.addUserMessage(n.content):this.addAssistantMessage(n.content)}),this.onSessionLoaded&&this.onSessionLoaded(s.data))}catch(s){console.error("\uC138\uC158 \uB85C\uB4DC \uC2E4\uD328:",s)}}clearMessages(){this.messagesEl.innerHTML=""}async ensureSession(){if(this.sessionId)return this.sessionId;this.onSessionCreating&&this.onSessionCreating();let t=await this.api.createSession(this.config.contentIds||[],{courseId:this.config.courseId,courseUserId:this.config.courseUserId,lessonId:this.config.lessonId,settings:this.config.settings});return t.success&&(this.sessionId=t.data.session.id,this.onSessionCreated&&this.onSessionCreated(t.data)),this.sessionId}async sendMessage(t){let s=t||this.inputEl.value.trim();if(!(!s||this.isLoading)){this.inputEl.value="",this.addUserMessage(s),this.setLoading(!0),this.addTypingIndicator();try{await this.ensureSession();let e=await this.api.sendMessage(s,this.sessionId,this.config.settings||{});this.removeTypingIndicator(),e.success?this.addAssistantMessage(e.data.response):this.addAssistantMessage("\uC8C4\uC1A1\uD569\uB2C8\uB2E4. \uC751\uB2F5\uC744 \uC0DD\uC131\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.")}catch(e){console.error("\uBA54\uC2DC\uC9C0 \uC804\uC1A1 \uC2E4\uD328:",e),this.removeTypingIndicator(),this.addAssistantMessage("\uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4: "+e.message)}this.setLoading(!1)}}addUserMessage(t){let s=document.createElement("div");s.className="chatbot-msg chatbot-msg--user",s.innerHTML=`<div class="chatbot-msg-content">${d(t)}</div>`,this.messagesEl.appendChild(s),this.scrollToBottom()}addAssistantMessage(t){let s=document.createElement("div");s.className="chatbot-msg chatbot-msg--assistant",s.innerHTML=`<div class="chatbot-msg-content">${q(t)}</div>`,this.messagesEl.appendChild(s),this.scrollToBottom()}addTypingIndicator(){if(document.getElementById("malgn-typing"))return;let t=document.createElement("div");t.id="malgn-typing",t.className="chatbot-msg chatbot-msg--assistant chatbot-msg--typing",t.innerHTML=`
      <div class="chatbot-msg-content">
        <span class="chatbot-typing-dot"></span>
        <span class="chatbot-typing-dot"></span>
        <span class="chatbot-typing-dot"></span>
      </div>
    `,this.messagesEl.appendChild(t),this.scrollToBottom()}removeTypingIndicator(){let t=document.getElementById("malgn-typing");t&&t.remove()}setLoading(t){this.isLoading=t,this.sendBtn.disabled=t,this.inputEl.disabled=t,t||this.inputEl.focus()}scrollToBottom(){requestAnimationFrame(()=>{let t=document.getElementById("malgn-body");t&&(t.scrollTop=t.scrollHeight)})}}});var p,w=r(()=>{g();p=class{constructor(){this.onQuestionClick=null}init(){document.querySelectorAll("#malgn-chatbot .chatbot-tab").forEach(s=>{s.addEventListener("click",()=>this.switchTab(s.dataset.tab))})}switchTab(t){let s=document.querySelectorAll("#malgn-chatbot .chatbot-tab"),e=document.querySelectorAll("#malgn-chatbot .malgn-tab-content");s.forEach(i=>i.classList.remove("active")),e.forEach(i=>i.classList.remove("active"));let n=document.querySelector(`#malgn-chatbot .chatbot-tab[data-tab="${t}"]`),a=document.getElementById(`malgn-tab-${t}`);n&&n.classList.add("active"),a&&a.classList.add("active");let c=document.getElementById("malgn-body");c&&(c.scrollTop=0)}renderLearningData(t){let s=document.getElementById("malgn-goals-text");s&&(s.textContent=t.goal||"\uD559\uC2B5 \uBAA9\uD45C\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");let e=document.getElementById("malgn-summary-text");if(e){let a=t.summary;Array.isArray(a)&&a.length>0?e.innerHTML=a.map((c,i)=>`<div class="chatbot-summary-item">
            <span class="chatbot-badge">${i+1}</span>${d(c)}
          </div>`).join(""):a?e.textContent=a:e.textContent="\uC694\uC57D\uC774 \uC0DD\uC131\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."}let n=document.getElementById("malgn-recommend-text");if(n){let a=t.recommendedQuestions||[];a.length>0?(n.innerHTML=a.map((c,i)=>`<div class="chatbot-recommend-question" data-question="${d(c)}">
            <span class="chatbot-badge chatbot-badge-primary">${i+1}</span>${d(c)}
          </div>`).join(""),n.querySelectorAll(".chatbot-recommend-question").forEach(c=>{c.addEventListener("click",()=>{let i=c.dataset.question;i&&this.onQuestionClick&&this.onQuestionClick(i)})})):n.textContent="\uCD94\uCC9C \uC9C8\uBB38\uC774 \uC0DD\uC131\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."}}clearLearningData(){let t=document.getElementById("malgn-goals-text"),s=document.getElementById("malgn-summary-text"),e=document.getElementById("malgn-recommend-text"),n=document.getElementById("malgn-quiz-text");t&&(t.textContent="\uD559\uC2B5 \uBAA9\uD45C\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."),s&&(s.textContent="\uC694\uC57D\uC774 \uC0DD\uC131\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."),e&&(e.textContent="\uCD94\uCC9C \uC9C8\uBB38\uC774 \uC0DD\uC131\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."),n&&(n.textContent="\uD034\uC988\uAC00 \uC0DD\uC131\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.")}}});var f,L=r(()=>{g();f=class{constructor(t){this.api=t,this.quizzes=[],this.currentIndex=0,this.answers={}}async loadQuizzes(t){let s=document.getElementById("malgn-quiz-text");if(s)try{let e=await this.api.getQuizzes(t);e.success&&e.data.quizzes&&e.data.quizzes.length>0?(this.quizzes=e.data.quizzes,this.currentIndex=0,this.answers={},this.renderCurrentQuiz()):s.textContent="\uD034\uC988\uAC00 \uC0DD\uC131\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4."}catch(e){console.error("\uD034\uC988 \uB85C\uB4DC \uC2E4\uD328:",e),s.textContent="\uD034\uC988\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."}}renderCurrentQuiz(){let t=document.getElementById("malgn-quiz-text");if(!t||this.quizzes.length===0)return;let s=this.quizzes[this.currentIndex],e=this.quizzes.length,n=this.currentIndex+1,a=s.quizType==="choice",c=`
      <div class="chatbot-quiz">
        <div class="chatbot-quiz-progress">
          <span class="chatbot-quiz-count">${n} / ${e}</span>
          <span class="chatbot-quiz-type-badge ${a?"choice":"ox"}">
            ${a?"4\uC9C0\uC120\uB2E4":"OX\uD034\uC988"}
          </span>
        </div>
        <div class="chatbot-quiz-question">
          <strong>Q${n}.</strong> ${d(s.question)}
        </div>
        <div class="chatbot-quiz-options">
    `;if(a)s.options.forEach((l,v)=>{let y=v+1,C=this.answers[s.id]===String(y);c+=`
          <div class="chatbot-quiz-option ${C?"selected":""}" data-quiz-id="${s.id}" data-answer="${y}">
            <span class="chatbot-option-num">${y}</span>
            <span>${d(l)}</span>
          </div>
        `});else{let l=this.answers[s.id]==="O",v=this.answers[s.id]==="X";c+=`
        <div class="chatbot-quiz-ox-options">
          <div class="chatbot-quiz-option chatbot-quiz-ox ${l?"selected":""}" data-quiz-id="${s.id}" data-answer="O">O</div>
          <div class="chatbot-quiz-option chatbot-quiz-ox ${v?"selected":""}" data-quiz-id="${s.id}" data-answer="X">X</div>
        </div>
      `}c+=`
        </div>
        <div class="chatbot-quiz-nav">
          <div class="chatbot-quiz-nav-buttons">
            <button class="chatbot-btn chatbot-btn-outline" id="malgn-prev-quiz" ${n===1?"disabled":""}>
              <i class="bi bi-chevron-left"></i> \uC774\uC804
            </button>
            <button class="chatbot-btn chatbot-btn-outline" id="malgn-next-quiz" ${n===e?"disabled":""}>
              \uB2E4\uC74C <i class="bi bi-chevron-right"></i>
            </button>
          </div>
          <button class="chatbot-btn chatbot-btn-primary" id="malgn-check-answer">\uC815\uB2F5 \uD655\uC778</button>
        </div>
        <div class="chatbot-quiz-result" id="malgn-quiz-result" style="display: none;"></div>
      </div>
    `,t.innerHTML=c,t.querySelectorAll(".chatbot-quiz-option").forEach(l=>{l.addEventListener("click",()=>{this.answers[l.dataset.quizId]=l.dataset.answer,this.renderCurrentQuiz()})});let i=document.getElementById("malgn-prev-quiz"),u=document.getElementById("malgn-next-quiz"),z=document.getElementById("malgn-check-answer");i&&i.addEventListener("click",()=>this.prev()),u&&u.addEventListener("click",()=>this.next()),z&&z.addEventListener("click",()=>this.checkAnswer())}prev(){this.currentIndex>0&&(this.currentIndex--,this.renderCurrentQuiz())}next(){this.currentIndex<this.quizzes.length-1&&(this.currentIndex++,this.renderCurrentQuiz())}checkAnswer(){let t=this.quizzes[this.currentIndex],s=this.answers[t.id],e=document.getElementById("malgn-quiz-result");if(!e)return;if(!s){e.className="chatbot-quiz-result",e.innerHTML='<span class="text-warning">\uB2F5\uC744 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.</span>',e.style.display="block";return}let n=s===t.answer,a=n?"chatbot-result-correct":"chatbot-result-wrong",c=n?"bi-check-circle-fill":"bi-x-circle-fill",i=n?"\uC815\uB2F5\uC785\uB2C8\uB2E4.":"\uC624\uB2F5\uC785\uB2C8\uB2E4.";e.className=`chatbot-quiz-result ${n?"correct":"wrong"}`;let u=`
      <div class="${a}">
        <i class="bi ${c} chatbot-result-icon"></i>${i}
      </div>
    `;t.explanation&&(u+=`<div class="chatbot-result-explanation"><strong>\uD574\uC124:</strong> ${d(t.explanation)}</div>`),e.innerHTML=u,e.style.display="block"}}});var M=T(()=>{I();E();x();w();L();if(window.__malgnTutorLoaded)console.warn("[MalgnTutor] Already loaded, skipping.");else{let o=function(){let t=window.MalgnTutor;if(!t||!t.apiUrl){console.error("[MalgnTutor] window.MalgnTutor.apiUrl is required.");return}if(!document.querySelector('link[href*="bootstrap-icons"]')){let i=document.createElement("link");i.rel="stylesheet",i.href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css",document.head.appendChild(i)}let s=new m(t.apiUrl,t.apiKey);h.inject({width:t.width||380,height:t.height||650});let e=new p;e.init();let n=new f(s),a=new b(s,{contentIds:t.contentIds||[],courseId:t.courseId||0,courseUserId:t.courseUserId||0,lessonId:t.lessonId||0,settings:t.settings||{}});a.init(),a.onSessionCreating=()=>{h.setFabLoading(!0)},a.onSessionCreated=i=>{h.setFabLoading(!1),i.learning&&e.renderLearningData(i.learning),i.session&&i.session.id&&n.loadQuizzes(i.session.id)},a.onSessionLoaded=i=>{i.learning&&e.renderLearningData(i.learning),i.id&&n.loadQuizzes(i.id)},e.onQuestionClick=i=>{a.sendMessage(i)},t.sessionId&&a.loadSession(t.sessionId),document.getElementById("malgn-fab").addEventListener("click",()=>h.toggle());let c=document.getElementById("malgn-close");console.log("[MalgnTutor] Close button found:",c),c?c.addEventListener("click",i=>{console.log("[MalgnTutor] Close button clicked"),i.preventDefault(),i.stopPropagation(),h.close()}):console.error("[MalgnTutor] Close button not found!"),console.log("[MalgnTutor] Initialized successfully.")};window.__malgnTutorLoaded=!0,document.readyState==="loading"?document.addEventListener("DOMContentLoaded",o):o()}});M();})();
