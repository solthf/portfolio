// data.json → index.html. 내용 수정은 data.json에서 하고 `node build.mjs` 실행.
// 프로젝트 순서·대표작은 data.json의 projects 순서와 featured(1,2,3…)로 정함.
// 화면 구성: PC는 윈도우 바탕화면(창·작업 표시줄), 모바일은 갤럭시 홈 화면(위젯·앱 화면). 같은 마크업을 style.css가 두 가지로 보여줌.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const d = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const s = d.site;
const esc = (v = '') => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KIND = { video: 'Video', graphic: 'Graphic' };
const byId = Object.fromEntries(d.projects.map(p => [p.id, p]));
const ext = h => /^https?:/.test(h) || h.startsWith('detail/') ? ' target="_blank" rel="noopener"' : '';

// 직접 그린 선 아이콘(24px 격자)
const ICON = {
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.6-3.9 3.7-6 7.5-6s6.9 2.1 7.5 6"/>',
  apps: '<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7.5l8 5.5 8-5.5"/>',
  phone: '<path d="M6.5 3.5h3l1.8 4.6-2.2 1.4a11 11 0 0 0 5.4 5.4l1.4-2.2 4.6 1.8v3a2 2 0 0 1-2.1 2A16 16 0 0 1 4.5 5.6a2 2 0 0 1 2-2.1z"/>',
  chat: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4.3A2.5 2.5 0 0 1 4 13.5z"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="M20.5 16l-5-5L5 20"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.8 16a5 5 0 0 1 6.4 0"/><circle cx="12" cy="19" r=".8"/>',
  min: '<path d="M7 12h10"/>', max: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>', close: '<path d="M7 7l10 10M17 7L7 17"/>',
};
const svg = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

const img = (p, cls = '', lazy = true) => {
  const style = [p.fit === 'contain' && 'object-fit:contain', p.position && `object-position:${p.position}`].filter(Boolean).join(';');
  return `<img${cls ? ` class="${cls}"` : ''} src="${esc(p.image)}" alt="${esc(p.alt || p.title)}"${style ? ` style="${style}"` : ''}${lazy ? ' loading="lazy"' : ''}>`;
};
const meta = (p, kind = true) => `<p class="meta">${kind ? `<span class="meta__kind">${KIND[p.kind]}</span>` : ''}<span>${esc(p.date)}</span>${p.note ? `<span>${esc(p.note)}</span>` : ''}</p>`;
const tools = p => `<p class="tools">${p.tools.map(esc).join(', ')}</p>${p.role ? `<dl class="role">${[['solo', '단독'], ['team', '공동']].filter(([k]) => p.role[k]).map(([k, t]) => `<div><dt class="role__${k}">${t}</dt><dd>${esc(p.role[k])}</dd></div>`).join('')}</dl>` : ''}`;
// 초안의 '?'는 확인 전 표시라 배포 전에 모두 지워야 함
const unsure = d.projects.filter(p => Object.values(p.role || {}).join('').includes('?')).map(p => p.id);
if (unsure.length) console.warn(`역할 확인 필요(?): ${unsure.join(', ')}`);

// 열기 동작: 링크 목록(팝업) / 이미지 확대(팝업) / 카드뉴스 넘겨 보기(팝업) / 바로 이동. 스크립트가 .card 안의 .link·.links를 읽음.
const opener = (p, visible) => {
  const label = p.links ? '목록 보기' : p.slides ? `${p.slides.length}장 넘겨 보기` : p.zoom ? '이미지 크게 보기' : p.hrefLabel || '보기';
  const text = visible ? (p.links ? `작업 ${p.links.length}개 보기` : p.slides ? label : p.zoom ? '크게 보기' : label) : '';
  const cls = visible ? 'link btn' : 'link';
  const aria = visible ? '' : ` aria-label="${esc(p.title)} ${label}"`;
  const list = p.links ? `<ul class="links" hidden>${p.links.map(l => `<li><a href="${esc(l.href)}"${ext(l.href)}>${esc(l.label)}<small>${esc(l.via)}</small></a></li>`).join('')}</ul>` : '';
  if (p.href) return `<a class="${cls}" href="${esc(p.href)}"${ext(p.href)}${aria}>${text}</a>`;
  return `<button class="${cls}" type="button"${p.zoom ? ` data-img="${esc(p.zoom)}"` : ''}${p.slides ? ` data-slides="${p.slides.map(esc).join(' ')}"` : ''}${aria}>${text}</button>${list}`;
};

const featured = d.projects.filter(p => p.featured).sort((a, b) => a.featured - b.featured);
// 작업 폴더: 대표 프로젝트 포함, 항상 최신순(끝난 날짜 → 시작 날짜). "2026"처럼 월이 없으면 그해 12월로 봄
const ym = t => { const [y, m = '12'] = t.trim().split('.'); return +y * 100 + +m; };
const when = p => { const [a, b = a] = p.date.split('~'); return [ym(b), ym(a)]; };
const rest = [...d.projects].sort((x, y) => { const [xe, xs] = when(x), [ye, ys] = when(y); return ye - xe || ys - xs; });
const count = k => rest.filter(p => p.kind === k).length;

// 창 제목 표시줄(PC) + 뒤로 가기 줄(모바일). 최소화·최대화·닫기는 장식이라 스크린리더에서 숨김.
const chrome = (icon, name) => `
    <div class="win__bar" aria-hidden="true"><span class="win__app">${svg(icon)}${esc(name)}</span><span class="win__caps">${svg('min')}${svg('max')}${svg('close')}</span></div>
    <div class="app__top"><a class="app__back" href="#top" aria-label="홈 화면으로">${svg('back')}</a><span>${esc(name)}</span></div>`;

const feature = (p, i) => `
        <article class="card feature${i === 0 ? ' feature--lead' : ''}" id="p-${p.id}" data-c="${p.kind}">
          <div class="feature__text">
            ${meta(p)}
            <h3>${esc(p.title)}</h3>
            <p class="feature__desc">${esc(p.desc)}</p>
            ${tools(p)}
            <div class="feature__act">${opener(p, true)}</div>
          </div>
          ${p.figures
            ? `<dl class="feature__proof figures">${p.figures.map(f => `<div><dt>${esc(f.label)}</dt><dd class="figure num">${esc(f.value)}</dd></div>`).join('')}</dl>`
            : `<figure class="feature__proof">${img(p)}</figure>`}
        </article>`;

const file = p => `
          <article class="card file" id="w-${p.id}" data-c="${p.kind}">
            <div class="file__thumb">${img(p)}${meta(p, false)}</div>
            <div class="file__main">
              <h3>${esc(p.title)}</h3>
              <p class="file__desc">${esc(p.desc)}</p>
              ${tools(p)}
            </div>
            ${opener(p, false)}
          </article>`;

// 폴더 아이콘: 해당 분류 작업 썸네일 3장이 반투명 앞판 뒤로 꽂혀 있음
const folder = k => {
  const thumbs = d.projects.filter(p => p.kind === k && !p.fit).slice(0, 3);
  return `<span class="folder" aria-hidden="true"><span class="folder__back"></span>${thumbs.map(p => `<img src="${esc(p.image)}" alt="" loading="lazy">`).join('')}<span class="folder__front"></span></span>`;
};
const icon = (href, art, label, extra = '') => `
        <a class="icon" href="${href}"${extra}>${art}<span class="icon__label">${esc(label)}</span></a>`;
const tile = (name, tone = '') => `<span class="tile${tone ? ` tile--${tone}` : ''}" aria-hidden="true">${svg(name)}</span>`;

// 갤러리: 누르면 대표 프로젝트면 그 카드로, 아니면 작업 폴더의 해당 탭·카드로 이동
const stills = s.heroStills.map(id => byId[id]).map(p => `
          <a class="still" href="#${p.featured ? `p-${p.id}` : `w-${p.id}" data-f="${p.kind}`}">${img(p, '', false)}<span>${esc(p.title)}</span></a>`).join('');

// [id, 아이콘, 창 이름, 모바일 하단 메뉴 이름]
const sections = [['projects', 'star', '대표 프로젝트', '프로젝트'], ['about', 'person', '이력', '이력'], ['skills', 'apps', '설치된 앱', '스킬'], ['works', 'folder', '작업 폴더', '작업'], ['contact', 'mail', '받은 메일', '연락']];
const mailto = `mailto:${esc(s.contact.email)}`;

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f3f1f7">
<title>${esc(s.title)}</title>
<meta name="description" content="${esc(s.description)}">
<link rel="preload" href="fonts/Pretendard-Bold.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="style.css?v=${createHash('md5').update(readFileSync('style.css')).digest('hex').slice(0, 8)}">
</head>
<body>
<!-- 이 파일은 build.mjs가 data.json으로 생성함. 직접 수정하지 말 것. -->
<div class="wall" aria-hidden="true"></div>


<main class="desk">
  <header class="home" id="top">
    <nav class="icons" aria-label="바로가기">${icon('#projects', tile('star', 'accent'), '대표 프로젝트')}${icon('#about', tile('person'), '이력')}${icon('#skills', tile('apps', 'soft'), '스킬')}${icon('#works', folder('video'), 'Video', ' data-f="video"')}${icon('#works', folder('graphic'), 'Graphic', ' data-f="graphic"')}${icon('#contact', tile('mail', 'dark'), '연락처')}
    </nav>

    <article class="widget hello">
      <div class="hello__who">
        <button class="face" type="button" data-img="${esc(s.profile)}" aria-label="프로필 사진 크게 보기"><img src="${esc(s.profile)}" alt="${esc(s.name)} 프로필 사진"></button>
        <p><strong>${esc(s.name)}</strong><span>${esc(s.nameEn)}, ${esc(s.role)}</span></p>
      </div>
      <h1>${s.headline.map(l => `<span>${esc(l)}</span>`).join('')}</h1>
      <p class="lead">${esc(s.lead)}</p>
      <div class="actions">
        <a class="btn btn--primary" href="#projects">프로젝트 보기</a>
        <a class="btn" href="#contact">연락하기</a>
      </div>
    </article>

    <article class="widget gallery" aria-label="작업 스틸">
      <p class="widget__name">${svg('image')}갤러리</p>
      <div class="gallery__grid">${stills}
      </div>
    </article>
  </header>

  <section id="projects" class="win">${chrome('star', '대표 프로젝트')}
    <div class="win__body">
      <h2>PROJECTS</h2>
      <div class="features">${featured.map(feature).join('')}
      </div>
    </div>
  </section>

  <section id="about" class="win">${chrome('person', '이력')}
    <div class="win__body">
      <h2>EXPERIENCE</h2>
      <div class="panel me">
        <button class="face" type="button" data-img="${esc(s.profile)}" aria-label="프로필 사진 크게 보기"><img src="${esc(s.profile)}" alt="" loading="lazy"></button>
        <p><strong>${esc(s.name)}</strong><span>${esc(s.role)}</span></p>
        <p class="me__total">${esc(d.experience.total)}</p>
      </div>
      <ol class="panel jobs">${d.experience.jobs.map(j => `
        <li class="job">
          <div class="job__who"><h3>${esc(j.org)}${j.note ? ` <small>${esc(j.note)}</small>` : ''}</h3><p>${esc(j.role)}</p></div>
          <p class="job__period num">${esc(j.period)}</p>
          <ul class="job__points">${j.points.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        </li>`).join('')}
      </ol>
      <div class="resume">${d.resume.map(g => `
        <div class="panel">
          <h3>${esc(g.label)}</h3>
          <dl>${g.items.map(i => `<div><dt class="num">${esc(i.date)}</dt><dd>${esc(i.text)}</dd></div>`).join('')}</dl>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <section id="skills" class="win">${chrome('apps', '설치된 앱')}
    <div class="win__body">
      <h2>SKILLS</h2>${d.skills.map(g => `
      <div class="panel skills">
        <h3>${esc(g.group)}</h3>
        <ul>${g.items.map(t => `<li><img src="${esc(t.icon)}" alt="" width="36" height="36" loading="lazy"><span class="skills__name">${esc(t.name)}</span><span class="skills__desc">${esc(t.desc)}</span></li>`).join('')}</ul>
      </div>`).join('')}
    </div>
  </section>

  <section id="works" class="win explorer">${chrome('folder', '작업 폴더')}
    <div class="win__body">
      <h2>WORKS</h2>
      <div class="ex">
        <div class="tabs" role="group" aria-label="프로젝트 분류">
          <button type="button" aria-pressed="true" data-f="video">${svg('folder')}Video<span class="num">${count('video')}</span></button>
          <button type="button" aria-pressed="false" data-f="graphic">${svg('folder')}Graphic<span class="num">${count('graphic')}</span></button>
        </div>
        <div class="ex__main">
          <p class="ex__path">내 작업${svg('chev')}<span data-crumb>전체</span></p>
          <div class="index">${rest.map(file).join('')}
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="contact" class="win mail">${chrome('mail', '받은 메일')}
    <div class="win__body">
      <h2 class="visually-hidden">CONTACT</h2>
      <dl class="mail__head">
        <div><dt>보낸 사람</dt><dd><span class="chip"><button class="face" type="button" data-img="${esc(s.profile)}" aria-label="프로필 사진 크게 보기"><img src="${esc(s.profile)}" alt="" loading="lazy"></button>${esc(s.name)}<span>${esc(s.role)}</span></span></dd></div>
        <div><dt>이메일</dt><dd><a href="${mailto}">${esc(s.contact.email)}</a></dd></div>
        <div><dt>전화</dt><dd><a href="tel:${esc(s.contact.tel)}">${esc(s.contact.phone)}</a></dd></div>
      </dl>
      <div class="mail__body">
        <p>${s.contact.title.map(esc).join('<br>')}</p>
      </div>
      <div class="actions">
        <a class="btn btn--primary" href="${mailto}">답장하기</a>
        <a class="btn" href="tel:${esc(s.contact.tel)}">전화 걸기</a>
      </div>
    </div>
  </section>

  <footer class="foot">
    <p>${esc(s.closing)}</p>
    <p>${esc(s.copyright)}</p>
  </footer>
</main>

<nav class="taskbar" aria-label="작업 표시줄">
  <div class="tb__apps">
    <a class="tb__start" href="#top" data-tip="홈" aria-label="홈"><span class="tb__is">IS</span><span class="tb__label" aria-hidden="true">홈</span></a>${sections.map(([id, ic, name, short]) => `
    <a href="#${id}" data-tip="${esc(name)}" aria-label="${esc(name)}">${svg(ic)}<span class="tb__label" aria-hidden="true">${esc(short)}</span></a>`).join('')}
  </div>
  <div class="tb__tray" aria-hidden="true">
    <span>한</span>${svg('wifi')}
    <span class="tb__clock"><span data-clock>오전 9:41</span><span data-date></span></span>
  </div>
</nav>

<dialog id="pick" aria-labelledby="pick-t">
  <button class="close" type="button" aria-label="닫기">${svg('close')}</button>
  <h3 id="pick-t"></h3>
  <p class="hint">확인할 콘텐츠를 선택하세요</p>
  <ul></ul>
  <div class="deck" hidden>
    <div class="deck__track" tabindex="0" aria-label="카드뉴스, 좌우로 넘겨 보기"></div>
    <div class="deck__nav"><button class="deck__btn" type="button" data-step="-1" aria-label="이전 장">${svg('back')}</button><span class="deck__count num"></span><button class="deck__btn" type="button" data-step="1" aria-label="다음 장">${svg('chev')}</button></div>
  </div>
</dialog>

<script>
// 시계: 상태 표시줄·작업 표시줄
const tFmt = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' });
const tick = () => {
  const n = new Date();
  document.querySelectorAll('[data-clock]').forEach(e => e.textContent = tFmt.format(n));
  document.querySelectorAll('[data-date]').forEach(e => e.textContent = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'));
};
tick(); setInterval(tick, 20000);

// 작업 폴더 탭(Video·Graphic)
const tabs = document.querySelectorAll('#works .tabs button');
const crumb = document.querySelector('[data-crumb]');
const show = f => {
  tabs.forEach(x => x.setAttribute('aria-pressed', x.dataset.f === f));
  document.querySelectorAll('#works .card').forEach(c => c.hidden = c.dataset.c !== f);
  crumb.textContent = f === 'video' ? 'Video' : 'Graphic';
};
tabs.forEach(b => b.onclick = () => show(b.dataset.f));
document.querySelectorAll('a[data-f]').forEach(a => a.addEventListener('click', () => show(a.dataset.f)));
show('video');

// 링크 목록·이미지 확대 팝업
const dlg = document.getElementById('pick');
const zoom = dlg.appendChild(document.createElement('img')); zoom.hidden = true; // 확대 이미지는 열 때 채움
document.querySelectorAll('button.link').forEach(b => b.onclick = () => {
  const card = b.closest('.card');
  dlg.querySelector('h3').textContent = card.querySelector('h3').textContent;
  const img = b.dataset.img, list = card.querySelector('.links'), slides = b.dataset.slides ? b.dataset.slides.split(' ') : null;
  const title = card.querySelector('h3').textContent;
  dlg.classList.toggle('wide', !!img);
  dlg.classList.toggle('slides', !!slides);
  dlg.querySelector('.hint').hidden = !list;
  deck.hidden = !slides;
  if (slides) { track.innerHTML = slides.map((src, i) => '<img src="' + src + '" alt="' + title + ' ' + (i + 1) + '/' + slides.length + '">').join(''); track.scrollLeft = 0; count(); track.style.removeProperty('--ratio'); track.firstChild.onload = e => track.style.setProperty('--ratio', e.target.naturalWidth / e.target.naturalHeight); }
  dlg.querySelector('ul').innerHTML = list ? list.innerHTML : '';
  zoom.hidden = !img;
  if (img) { zoom.src = img; zoom.alt = card.querySelector('h3').textContent; }
  dlg.showModal();
  if (slides) count(); // 열린 뒤에 폭이 생김
});
// 프로필 사진 크게 보기
document.querySelectorAll('button.face').forEach(b => b.onclick = () => {
  dlg.querySelector('h3').textContent = '${esc(s.name)}';
  dlg.classList.remove('wide', 'slides');
  dlg.querySelector('.hint').hidden = true; deck.hidden = true; dlg.querySelector('ul').innerHTML = '';
  zoom.hidden = false; zoom.src = b.dataset.img; zoom.alt = '${esc(s.name)} 프로필 사진';
  dlg.showModal();
});
dlg.querySelector('.close').onclick = () => dlg.close();
// 카드뉴스 넘겨 보기: 손가락으로 밀거나 버튼·방향키로 한 장씩
const deck = dlg.querySelector('.deck'), track = deck.querySelector('.deck__track');
const count = () => { const n = track.children.length, i = track.clientWidth ? Math.round(track.scrollLeft / track.clientWidth) : 0; deck.querySelector('.deck__count').textContent = (i + 1) + ' / ' + n;
  deck.querySelectorAll('.deck__btn').forEach(x => x.disabled = x.dataset.step < 0 ? i === 0 : i === n - 1); };
track.addEventListener('scroll', count, { passive: true });
const still = matchMedia('(prefers-reduced-motion: reduce)');
deck.querySelectorAll('.deck__btn').forEach(x => x.onclick = () => track.scrollBy({ left: x.dataset.step * track.clientWidth, behavior: still.matches ? 'auto' : 'smooth' }));
dlg.onclick = e => { if (e.target === dlg) dlg.close(); }; // 바깥 클릭 시 닫기

// 작업 표시줄: 지금 보고 있는 창 표시
const tb = [...document.querySelectorAll('.tb__apps a')];
// PC에선 이력·설치된 앱이 한 줄에 나란히 있으므로 둘 다 현재 위치로 표시
const wide = matchMedia('(min-width: 900px)');
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const on = wide.matches && (e.target.id === 'about' || e.target.id === 'skills') ? ['#about', '#skills'] : ['#' + e.target.id];
  tb.forEach(a => on.includes(a.hash) ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current'));
}), { rootMargin: '-40% 0px -55% 0px' });
document.querySelectorAll('#top, main > section[id]').forEach(x => io.observe(x));
</script>
</body>
</html>
`;

// 대표작·스틸 id 오타는 조용히 빈 화면이 되므로 여기서 막음
for (const id of s.heroStills) if (!byId[id]) throw new Error(`heroStills: 없는 프로젝트 id "${id}"`);
if (!featured.length) throw new Error('featured 프로젝트가 하나도 없음');

writeFileSync(new URL('./index.html', import.meta.url), html);
console.log(`index.html 생성: 대표 ${featured.length}개, 전체 작업 ${rest.length}개`);
