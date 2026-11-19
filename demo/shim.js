// 포트폴리오 체험판 전용: 실제 게임 DB(Supabase)에 아무것도 쓰지 않게 막음.
// 읽기(공지 목록, 상태 확인 등)는 그대로 실제 DB에서 받고, 쓰기는 이 브라우저 안에서 성공한 것처럼 흉내 냄.
(() => {
  const real = window.fetch.bind(window);
  let seq = 9e8;
  const reply = (data) => Promise.resolve(new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const body = (o) => { try { return JSON.parse(o && o.body || '{}'); } catch { return {}; } };

  // 표본사회 입소 검사: 서버 대신 여기서 코드와 표본을 정함 (범인 표본 06은 배정하지 않음)
  const FILES = [['02', '머니'], ['03', '히어로'], ['04', '백지'], ['05', '카니']];
  const L = ['RP', 'EW', 'UI', 'OC'];
  const submit = ({ p_answers: a = [] }) => {
    const code = L.map((p, k) => { const s = a.slice(k * 3, k * 3 + 3).reduce((x, y) => x + (y || 0), 0); return p[s > 7 ? 1 : 0]; }).join('');
    const strength = L.map(() => 1 + Math.floor(Math.random() * 3)).join('');
    const [no, nick] = FILES[Math.floor(Math.random() * FILES.length)];
    return { code, strength, no: +no, nick, file_pw: '2026' };
  };

  // 쓰기 함수 → 가짜 응답. 여기 없는 rpc는 읽기로 보고 실제 DB로 보냄
  const WRITE = {
    ss_check: () => 'ok', ss_submit: submit, ss_staff: () => ({ error: 'demo' }), ss_staff_set: () => ({ error: 'demo' }),
    test_status: () => ({ open: true }), test_check: () => ({ ok: true, tester: false }), test_pick: () => ({ ok: true }), test_reset: () => ({ ok: true }),
    submit_reply: () => ({ ok: true, demo: true }),
    office_add: () => ({ ok: false, error: 'demo' }), office_delete: () => ({ ok: false, error: 'demo' }), office_set_open: () => ({ ok: false, error: 'demo' }),
    office_test_set: () => ({ ok: false, error: 'demo' }), office_test_member: () => ({ ok: false, error: 'demo' }),
    phone_lock_state: () => ({ fails: 0, wait: 0 }),
  };

  window.fetch = (input, o = {}) => {
    const url = String(input && input.url || input);
    if (!url.includes('.supabase.co')) return real(input, o);
    const method = (o.method || 'GET').toUpperCase();
    const fn = (url.match(/\/rpc\/([a-z_]+)/) || [])[1];
    if (fn) return fn in WRITE ? reply(WRITE[fn](body(o))) : real(input, o);
    if (method === 'GET') return reply([]); // 다른 방문자가 남긴 문자·사진·통화는 보이지 않음
    if (method === 'POST') return reply([{ ...body(o), id: ++seq, created_at: new Date().toISOString() }]);
    return reply([]);
  };
})();
