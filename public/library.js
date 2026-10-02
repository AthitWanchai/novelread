'use strict';
const $=s=>document.querySelector(s), main=$('#main');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>( {
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}
[c]));
let me=null, generation=0, cleanup=()=> {
};
const readKey = bid => `read:${me ? 'user:' + me.id : 'guest'}:${bid}`;
function readLocal(bid) {
  try {
    return JSON.parse(localStorage.getItem(readKey(bid)) || 'null');
  }
  catch {
    return null;
  }
}
function requireAccount(returnHash = location.hash, followBook = null) {
  sessionStorage.setItem('pending-account', JSON.stringify( {
    returnHash, followBook
  }
  ));
  location.hash = '#account';
}
async function finishAccount(importGuest) {
  const issues = [];
  if (importGuest) {
    for (const key of Object.keys(localStorage).filter(k => k.startsWith('read:guest:'))) {
      try {
        const position = JSON.parse(localStorage.getItem(key));
        await api('/shelf/' + key.split(':').pop(), 'PUT', position);
        localStorage.setItem(readKey(key.split(':').pop()), JSON.stringify(position));
        localStorage.removeItem(key);
      }
      catch {
        issues.push('บางตำแหน่งยังรับช่วงไม่ได้ · ตำแหน่งเดิมยังอยู่ในเครื่อง');
      }
    }
  }
  let pending;
  try {
    pending = JSON.parse(sessionStorage.getItem('pending-account') || 'null');
  }
  catch {
  }
  if (pending?.followBook) {
    try {
      await api('/shelf/' + pending.followBook, 'PUT', {followed:true});
      toast('ติดตามเรื่องแล้ว');
    } catch (error) {
      issues.push('ติดตามเรื่องไม่ได้: ' + error.message);
      pending.returnHash = '#shelf';
    }
  }
  sessionStorage.removeItem('pending-account');
  location.hash = pending?.returnHash?.match(/^#(read|book|writer|new|edit|chapter|shelf)(\/|$)/)
  ? pending.returnHash : '#shelf';
  return issues.join(' · ');
}
function bindCoverFallbacks() {
  main.querySelectorAll('.cover img').forEach(img => {
    img.onerror = () => {
      img.hidden = true;
      img.nextElementSibling.hidden = false;
    };
    if (img.complete && !img.naturalWidth) img.onerror();
  });
}
const categories=['แฟนตาซี','รักโรแมนติก','วาย','สืบสวน','ผจญภัย','ดราม่า','อื่น ๆ'];
const options=(items,value='')=>items.map(s=>`<option ${s===value?'selected':''}>${esc(s)}</option>`).join('');
async function api(path,method='GET',data) {
  const r=await fetch('/api/library'+path, {
    method,
    headers:data ? {'Content-Type':'application/json'} : {},
    body:data ? JSON.stringify(data) : undefined,
    keepalive:method === 'PUT' && path.startsWith('/shelf/')
  });
  let result;
  try {
    result=await r.json()
  }
  catch {
    throw Error('ติดต่อระบบไม่สำเร็จ')
  }
  if(!r.ok)throw Error(typeof result.detail==='string'?result.detail:'กรุณาตรวจข้อมูลที่กรอกให้ครบและถูกต้อง');
  return result
}
function toast(text) {
  clearTimeout(toast.timer);
  $('#toast').textContent=text;
  $('#toast').style.display='block';
  toast.timer=setTimeout(()=>$('#toast').style.display='none',3500)
}
function formAction(form,fn) {
  form.onsubmit=async e=> {
    e.preventDefault();
    const error=form.querySelector('.error');
    error.textContent='';
    const buttons=[...form.querySelectorAll('button')];
    buttons.forEach(b=>b.disabled=true);
    try {
      await fn(new FormData(form),e.submitter)
    }
    catch(err) {
      error.textContent=err.message
    }
    finally {
      buttons.forEach(b=>b.disabled=form.dataset.uploading === 'true')
    }
  }
}
const field=(name,label,value='',type='text',attrs='')=>`<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${attrs}></div>`;
const cover = b => `<div class="cover">${b.cover ? `<img src="${esc(b.cover)}" alt="ปก ${esc(b.title)}" loading="lazy" referrerpolicy="no-referrer">` : ''}<span ${b.cover?'hidden':''}>${esc(b.title)}</span></div>`;
function cards(books, writer=false, resume=false) {
  return `<div class="${resume?'shelf-list':writer?'grid writer-grid':'grid'}">${books.map(b => `<article class="card">
    <a class="card-link" href="#${writer?'edit':'book'}/${b.id}">${cover(b)}
      <h3>${esc(b.title)}</h3><p class="muted">${esc(b.pen_name)}</p>
      <span class="badge">${esc(b.category)}</span> <small>${esc(b.status)}</small>
      ${b.progress !== undefined ? `<p class="help">อ่านแล้ว ${Math.round(b.progress*100)}% ${b.followed?'· ติดตามอยู่':''}</p><progress max="1" value="${b.progress}" aria-label="ความคืบหน้าการอ่าน"></progress>` : `<p class="help">${b.chapter_count??''} ตอน · ${esc(b.rating)}</p>`}
    </a>${resume && b.chapter_id ? `<a class="button card-resume" href="#read/${b.chapter_id}">อ่านต่อ</a>` : writer?`<div class="actions"><a class="button plain" href="#edit/${b.id}">แก้ไขเรื่อง</a><a class="button" href="#chapter/${b.id}/new">เพิ่มตอน</a></div>`:''}
  </article>`).join('')}</div>`;
}
function empty(title,text,link,label) {
  return `<div class="empty"><h2>${title}</h2><p>${text}</p>${link?`<a class="button" href="${link}">${label}</a>`:''}</div>`
}
function accountLink() {
  $('#account').textContent=me?me.name:'เข้าสู่ระบบ';
  document.querySelectorAll('[data-account-label]').forEach(a=>a.textContent='บัญชี');
}
function bindTabs(container) {
  const tabs=[...container.querySelectorAll('[role="tab"]')];
  function sync() {tabs.forEach(tab=>tab.tabIndex=tab.getAttribute('aria-selected')==='true'?0:-1);}
  sync();
  container.addEventListener('click',sync);
  container.addEventListener('keydown',event=> {
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const index=tabs.indexOf(document.activeElement);
    if(index<0)return;
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    tabs[next].click();tabs[next].focus();sync();
  });
}
function soften(element) {
  if(element && !matchMedia('(prefers-reduced-motion: reduce)').matches)
    element.animate([{opacity:.8},{opacity:1}],{duration:160,easing:'cubic-bezier(.2,.7,.2,1)'});
}
async function home(g) {
  main.innerHTML=`<form id="search" class="toolbar" role="search"><input name="q" aria-label="ค้นหานิยาย" placeholder="ค้นหาชื่อเรื่อง นักเขียน หรือแท็ก"><select name="category" aria-label="หมวดนิยาย"><option value="">ทุกหมวด</option>${options(categories)}</select><select name="status" aria-label="สถานะนิยาย"><option value="">ทุกสถานะ</option>${options(['กำลังเขียน','จบแล้ว'])}</select><button>ค้นหา</button></form><div id="discover-intro"></div><div class="section-title"><h1 id="results-title">อัปเดตล่าสุด</h1><span class="muted" id="count" role="status"></span></div><div id="results" aria-busy="true">กำลังโหลดนิยาย…</div><div id="completed-books"></div>`;
  let seq=0;
  async function search() {
    const s=++seq;
    try {
      const query=new URLSearchParams(new FormData($('#search')));
      const books=await api('/books?'+query);
      if(g!==generation||s!==seq)return;
      $('#count').textContent=books.length+' เรื่อง';
      const filtered=[...query.values()].some(Boolean);
      $('#results-title').textContent=filtered?'ผลการค้นหา':'อัปเดตล่าสุด';
      $('#discover-intro').hidden=filtered;
      $('#completed-books').hidden=filtered;
      if(!filtered) {
        const shelfBooks=me?await api('/shelf'):books.map(b=>({...b,...readLocal(b.id)})).filter(b=>b.chapter_id).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
        if(g!==generation||s!==seq)return;
        const visibleIds=new Set(books.map(b=>b.id));
        const continuing=shelfBooks.filter(b=>b.chapter_id&&visibleIds.has(b.id)).slice(0,2);
        const featured=books[0];
        $('#discover-intro').innerHTML=`${continuing.length?`<section class="book-section"><div class="section-title"><h2>อ่านต่อ</h2>${me?'<a class="muted" href="#shelf">ชั้นหนังสือ →</a>':''}</div><div class="resume-grid">${continuing.map(b=>`<article class="resume-card">${cover(b)}<div class="resume-info"><h3>${esc(b.title)}</h3><p class="help">อ่านแล้ว ${Math.round(b.progress*100)}%</p><progress value="${b.progress}" max="1" aria-label="ความคืบหน้าการอ่าน"></progress></div><a class="button" href="#read/${b.chapter_id}">อ่านต่อ</a></article>`).join('')}</div></section>`:''}${featured?`<section class="featured-story">${cover(featured)}<div class="featured-content"><span class="eyebrow">เรื่องอัปเดตใหม่</span><h2>${esc(featured.title)}</h2><p class="muted">โดย ${esc(featured.pen_name)}</p><p class="summary">${esc(featured.summary||'เปิดเรื่องราวใหม่ แล้วเลือกตอนที่อยากอ่าน')}</p><a class="button" href="#book/${featured.id}">ดูเรื่องนี้ →</a></div></section>`:''}<div class="section-title"><h2>ค้นพบนิยาย</h2></div><div class="category-tabs" aria-label="เลือกหมวดนิยาย">${['ทั้งหมด',...categories].map((category,i)=>`<button class="${i?'plain':'secondary active'}" data-category="${i?esc(category):''}" aria-pressed="${!i}">${esc(category)}</button>`).join('')}</div>`;
        main.querySelectorAll('[data-category]').forEach(button=>button.onclick=()=> {
          $('#search').elements.category.value=button.dataset.category;
          search();
        });
        const completed=books.filter(b=>b.status==='จบแล้ว');
        $('#completed-books').innerHTML=completed.length?`<section class="book-section"><div class="section-title"><h2>เรื่องที่จบแล้ว</h2><button class="plain" id="show-completed">ดูทั้งหมด →</button></div>${cards(completed.slice(0,6))}</section>`:'';
        if($('#show-completed'))$('#show-completed').onclick=()=> {$('#search').elements.status.value='จบแล้ว';search();};
      }
      $('#results').innerHTML=books.length?cards(books):filtered?empty('ไม่พบเรื่องที่ตรงกับการค้นหา','ลองเปลี่ยนคำค้น หรือล้างตัวกรอง','#home','ล้างการค้นหา'):empty('ยังไม่มีนิยายเผยแพร่','เรื่องใหม่จะปรากฏที่นี่เมื่อผู้เขียนเผยแพร่','#writer','เริ่มเขียนเรื่องแรก');
      $('#results').setAttribute('aria-busy','false');
      if(filtered)$('#results').insertAdjacentHTML('afterbegin','<button id="clear-search" class="plain clear-search">ล้างการค้นหา</button>');
      if($('#clear-search'))$('#clear-search').onclick=()=> {$('#search').reset();search();};
      const emptyReset=$('#results .empty a');
      if(filtered&&emptyReset)emptyReset.onclick=event=> {event.preventDefault();$('#search').reset();search();};
      soften($('#results'));
      bindCoverFallbacks()
    }
    catch(e) {
      if(g===generation)$('#results').textContent=e.message
    }
  }
  $('#search').onsubmit=e=> {
    e.preventDefault();
    search()
  };
  await search()
}
function auth() {
  if(me) {
    main.innerHTML=`<div class="panel narrow"><div class="eyebrow">YOUR PROFILE</div><h1>บัญชีของคุณ</h1><p class="muted">${esc(me.email)}</p><form id="profile">${field('name','ชื่อแสดง (นักอ่านหรือนักเขียน)',me.name,'text','required maxlength="80"')}<div class="error" role="alert"></div><button>บันทึกโปรไฟล์</button></form><div class="actions"><button id="logout" class="plain">ออกจากระบบ</button></div></div>`;
    formAction($('#profile'),async f=> {
      me=await api('/profile','PUT', {
        name:f.get('name')
      });
      accountLink();
      toast('บันทึกโปรไฟล์แล้ว')
    });
    $('#logout').onclick=async()=> {
      try {
        await api('/logout','POST');
        me=null;
        accountLink();
        location.hash='#home'
      }
      catch(e) {
        toast(e.message)
      }
    };
    return
  }
  let register=false;
  const render=()=> {
    main.innerHTML=`<div class="panel narrow"><div class="eyebrow">WELCOME TO NOVELREAD</div><h1>${register?'สร้างบัญชีของคุณ':'ยินดีต้อนรับกลับ'}</h1><p class="muted">เก็บเรื่องโปรดและเริ่มเขียนนิยายของคุณ</p><form id="auth">${register?field('name','ชื่อแสดง (นักอ่านหรือนักเขียน)','','text','required maxlength="80" autocomplete="nickname"'):''}${field('email','อีเมล','','email','required autocomplete="email"')}${field('password','รหัสผ่าน','','password',`required minlength="8" maxlength="128" autocomplete="${register?'new-password':'current-password'}"`)}<p class="help">รหัสผ่านอย่างน้อย 8 ตัวอักษร</p><label class="help"><input type="checkbox" id="import-guest" checked> รับช่วงตำแหน่งที่อ่านก่อนเข้าสู่ระบบบนเครื่องนี้</label><div class="error" role="alert"></div><button>${register?'สมัครบัญชี':'เข้าสู่ระบบ'}</button></form><div class="actions"><button id="switch" class="plain">${register?'มีบัญชีแล้ว · เข้าสู่ระบบ':'ยังไม่มีบัญชี · สมัครสมาชิก'}</button></div></div>`;
    $('#switch').onclick=()=> {
      register=!register;
      render()
    };
    formAction($('#auth'),async f=> {
      me=await api(register?'/register':'/login','POST',Object.fromEntries(f));
      accountLink();
      const issue = await finishAccount($('#import-guest').checked);
      toast(issue || (register?'สร้างบัญชีแล้ว':'เข้าสู่ระบบแล้ว'))
    }
    )
  };
  render()
}
function needLogin() {
  sessionStorage.setItem('pending-account',JSON.stringify( {
    returnHash:location.hash
  }
  ));
  main.innerHTML=empty('เข้าสู่ระบบเพื่อใช้งาน','บัญชีช่วยบันทึกชั้นหนังสือและผลงานของคุณ','#account','เข้าสู่ระบบ / สมัครบัญชี')
}
async function shelf(g) {
  if (!me) return needLogin();
  const books = await api('/shelf');
  if (g !== generation) return;
  const followed = books.filter(b => b.followed);
  const history = books.filter(b => b.chapter_id);
  main.innerHTML = `<h1>ชั้นหนังสือ</h1><p class="muted">กลับมาอ่านเรื่องที่ค้างไว้ หรือเลือกจากเรื่องที่ติดตาม</p>
    <div class="detail-tabs" role="tablist" aria-label="ชั้นหนังสือ"><button id="history-tab" class="plain active" role="tab" aria-selected="true" aria-controls="shelf-content">กำลังอ่าน (${history.length})</button><button id="followed-tab" class="plain" role="tab" aria-selected="false" aria-controls="shelf-content">ติดตาม (${followed.length})</button></div><div id="shelf-content" role="tabpanel" aria-labelledby="history-tab"></div>`;
  function render(follow) {
    const selected=follow?followed:history;
    $('#shelf-content').innerHTML=selected.length?cards(selected,false,true):empty(follow?'ยังไม่ได้ติดตามเรื่อง':'ยังไม่มีประวัติการอ่าน',follow?'กดติดตามจากหน้ารายละเอียดหรือหน้าอ่าน':'เลือกเรื่องที่อยากอ่าน แล้วกลับมาอ่านต่อได้ที่นี่','#home','ค้นพบนิยาย');
    $('#shelf-content').setAttribute('aria-labelledby',follow?'followed-tab':'history-tab');
    [$('#history-tab'),$('#followed-tab')].forEach((button,i)=> {button.classList.toggle('active',Boolean(i)===follow);button.setAttribute('aria-selected',String(Boolean(i)===follow));});
    bindCoverFallbacks();
    soften($('#shelf-content'));
  }
  $('#history-tab').onclick=()=>render(false);
  $('#followed-tab').onclick=()=>render(true);
  render(false);
  bindTabs(main.querySelector('[role="tablist"]'));
}
async function writer(g) {
  if(!me)return needLogin();
  const books=await api('/books?mine=true');
  if(g!==generation)return;
  main.innerHTML=`<div class="section-title"><h1>ผลงานของฉัน</h1><a class="button" href="#new">＋ สร้างเรื่องใหม่</a></div><p class="muted">จัดการนิยายของคุณ เขียนตอนใหม่ และเผยแพร่เมื่อพร้อม</p>${books.length?cards(books,true):empty('เรื่องแรกของคุณเริ่มที่นี่','ตั้งชื่อเรื่อง เพิ่มคำโปรย และเขียนตอนแรกได้เลย','#new','สร้างนิยาย')}`
}
async function detail(id,g) {
  const b=await api('/books/'+id);
  const saved=me?(await api('/shelf')).find(x=>x.id===b.id):readLocal(b.id);
  if(g!==generation)return;
  const chapters=b.chapters.filter(c=>c.published);
  const resume=chapters.find(c=>c.id===saved?.chapter_id)||chapters[0];
  main.innerHTML=`<a class="muted" href="#home">← ค้นพบนิยาย</a><section class="detail">${cover(b)}<div><span class="badge">${esc(b.category)}</span><h1>${esc(b.title)}</h1><p>โดย ${esc(b.pen_name)} · ${esc(b.status)} · ${esc(b.rating)}</p><p class="summary">${esc(b.summary||'ยังไม่มีคำโปรย')}</p><p class="help">${esc(b.tags)} · อัปเดต ${new Date(b.updated*1000).toLocaleDateString('th-TH')}</p><div class="actions">${resume?`<a class="button" href="#read/${resume.id}">${saved?.chapter_id?'อ่านต่อ':'เริ่มอ่าน'}</a>`:''}<button id="follow" class="secondary">${saved?.followed?'เลิกติดตาม':'ติดตามเรื่อง'}</button>${b.is_owner?`<a class="button plain" href="#edit/${b.id}">จัดการเรื่อง</a>`:''}</div></div></section><h2>สารบัญ · ${chapters.length} ตอน</h2>${chapters.length?`<ol class="chapter-list">${chapters.map((c,i)=>`<li><a href="#read/${c.id}">${i+1}. ${esc(c.title)}</a><small>${new Date(c.updated*1000).toLocaleDateString('th-TH')}</small></li>`).join('')}</ol>`:empty('ยังไม่มีตอนเผยแพร่','เจ้าของเรื่องกำลังเตรียมเนื้อหา')}`;
  bindCoverFallbacks();
  const tocHeading=main.querySelector('h2');
  const tocList=main.querySelector('.chapter-list')||main.querySelector('.empty');
  const tabBar=document.createElement('div');
  tabBar.className='detail-tabs';
  tabBar.setAttribute('role','tablist');
  tabBar.setAttribute('aria-label','รายละเอียดนิยาย');
  tabBar.innerHTML='<button id="summary-tab" role="tab" class="plain" aria-selected="false" aria-controls="detail-summary">เรื่องย่อ</button><button id="chapters-tab" role="tab" class="plain active" aria-selected="true" aria-controls="detail-chapters">สารบัญ</button>';
  const summaryPanel=document.createElement('section');
  summaryPanel.id='detail-summary';summaryPanel.hidden=true;summaryPanel.setAttribute('role','tabpanel');summaryPanel.setAttribute('aria-labelledby','summary-tab');
  summaryPanel.innerHTML=`<h2>เรื่องย่อ</h2><p class="summary">${esc(b.summary||'ยังไม่มีคำโปรย')}</p>`;
  const chaptersPanel=document.createElement('section');
  chaptersPanel.id='detail-chapters';chaptersPanel.setAttribute('role','tabpanel');chaptersPanel.setAttribute('aria-labelledby','chapters-tab');
  chaptersPanel.append(tocHeading,tocList);
  main.append(tabBar,summaryPanel,chaptersPanel);
  function showDetailSummary(show) {
    summaryPanel.hidden=!show;chaptersPanel.hidden=show;
    [$('#summary-tab'),$('#chapters-tab')].forEach((button,i)=> {const active=Boolean(i)!==show;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));});
    soften(show?summaryPanel:chaptersPanel);
  }
  $('#summary-tab').onclick=()=>showDetailSummary(true);
  $('#chapters-tab').onclick=()=>showDetailSummary(false);
  bindTabs(tabBar);
  $('#follow').onclick=async()=> {
    if(!me) {
      requireAccount(location.hash,id);
      return
    }
    try {
      await api('/shelf/'+id,'PUT', {
        followed:!saved?.followed
      });
      await detail(id,generation);
      toast(saved?.followed?'เลิกติดตามแล้ว · ประวัติการอ่านยังอยู่':'ติดตามเรื่องแล้ว')
    }
    catch(e) {
      toast(e.message)
    }
  }
}
async function editBook(id,g) {
  if(!me)return needLogin();
  const b=id?await api('/books/'+id): {
    pen_name:me.name,chapters:[]
  };
  if(g!==generation)return;
  if(id&&!b.is_owner)throw Error('แก้ไขได้เฉพาะผลงานของคุณ');
  main.innerHTML=`<a href="#writer" class="muted">← ผลงานของฉัน</a><div class="panel"><div class="eyebrow">WRITER STUDIO</div><h1>${id?'แก้ไขนิยาย':'สร้างเรื่องใหม่'}</h1><form id="bookform">${field('title','ชื่อเรื่อง',b.title,'text','required maxlength="200"')}${field('pen_name','นามปากกา',b.pen_name,'text','required maxlength="80"')}<div class="field"><label for="summary">คำโปรย / เรื่องย่อ</label><textarea id="summary" name="summary" rows="4" maxlength="10000">${esc(b.summary)}</textarea></div><div class="form-grid"><div class="field"><label for="category">หมวด</label><select id="category" name="category">${options(categories,b.category)}</select></div><div class="field"><label for="status">สถานะเรื่อง</label><select id="status" name="status">${options(['กำลังเขียน','จบแล้ว'],b.status)}</select></div></div>${field('tags','แท็ก (คั่นด้วยเครื่องหมายจุลภาค)',b.tags,'text','maxlength="300"')}${field('cover','ลิงก์รูปปก (ไม่จำเป็น)',b.cover,'text','maxlength="2000"')}<div class="field"><label for="cover-file">อัปโหลดปกจากเครื่อง</label><input id="cover-file" type="file" accept="image/png,image/jpeg,image/webp"><p class="help" id="cover-status">PNG, JPEG หรือ WebP ไม่เกิน 5 MB</p><div id="cover-preview">${cover(b)}</div></div><p class="help">เว้นว่างเพื่อใช้ปกชื่อเรื่องอัตโนมัติ</p><div class="field"><label for="rating">เรตเนื้อหา</label><select id="rating" name="rating">${options(['ทั่วไป','18+'],b.rating)}</select></div><div class="error" role="alert"></div><button>บันทึกข้อมูลเรื่อง</button></form>${id?`<div class="section-title"><h2>จัดการตอน</h2><a class="button secondary" href="#chapter/${id}/new">เพิ่มตอน</a></div><ol class="chapter-list">${b.chapters.map((c,i)=>`<li><a href="#chapter/${id}/${c.id}">${i+1}. ${esc(c.title)} <span class="badge">${c.published?'เผยแพร่':'ร่าง'}</span></a><button class="plain" data-index="${i}" data-dir="-1" aria-label="ย้ายตอน ${i+1} ขึ้น" ${i===0?'disabled':''}>↑</button><button class="plain" data-index="${i}" data-dir="1" aria-label="ย้ายตอน ${i+1} ลง" ${i===b.chapters.length-1?'disabled':''}>↓</button></li>`).join('')}</ol>${!b.chapters.length?'<p class="muted">ยังไม่มีตอน เพิ่มตอนแรกแล้วบันทึกร่างหรือเผยแพร่ได้เลย</p>':''}<a class="button plain" href="#book/${id}">ตรวจหน้ารายละเอียด</a>`:''}</div>`;
  bindCoverFallbacks();
  const bookForm = $('#bookform');
  const coverFields=[bookForm.querySelector('#cover').closest('.field'),bookForm.querySelector('#cover-file').closest('.field')];
  const bookLayout=document.createElement('div');bookLayout.className='book-editor-layout';
  const coverEditor=document.createElement('aside');coverEditor.className='cover-editor';coverEditor.setAttribute('aria-label','รูปปกนิยาย');
  const bookFields=document.createElement('div');bookFields.className='book-editor-fields';
  [...bookForm.children].filter(node=>!node.classList.contains('error')&&node.tagName!=='BUTTON').forEach(node=> {
    if(coverFields.includes(node))coverEditor.append(node);else bookFields.append(node);
  });
  bookLayout.append(coverEditor,bookFields);bookForm.prepend(bookLayout);
  const coverInput = $('#cover');
  const preview = $('#cover-preview');
  const status = $('#cover-status');
  let uploadSequence = 0;
  const active = sequence => g === generation && bookForm.isConnected && sequence === uploadSequence;
  function showPreview() {
    preview.innerHTML = cover({...b,title:$('#title').value || 'ปกชื่อเรื่อง',cover:coverInput.value});
    bindCoverFallbacks();
  }
  $('#cover-file').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    const sequence = ++uploadSequence;
    bookForm.dataset.uploading = 'true';
    bookForm.querySelector('button').disabled = true;
    try {
      if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 5*1024*1024)
        throw Error('ใช้ PNG, JPEG หรือ WebP ไม่เกิน 5 MB');
      status.textContent = 'กำลังอัปโหลดปก…';
      const data = await new Promise((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(Error('อ่านไฟล์ไม่ได้'));
        reader.readAsDataURL(file);
      });
      if (!active(sequence)) return;
      const result = await api('/covers','POST',{data});
      if (!active(sequence)) return;
      coverInput.value = result.url;
      showPreview();
      status.textContent = 'อัปโหลดปกแล้ว · กดบันทึกข้อมูลเรื่องเพื่อใช้ปกนี้';
    } catch (error) {
      if (active(sequence)) status.textContent = error.message;
    } finally {
      if (active(sequence)) {
        bookForm.dataset.uploading = 'false';
        bookForm.querySelector('button').disabled = false;
      }
    }
  };
  coverInput.onchange = () => {
    uploadSequence++;
    bookForm.dataset.uploading = 'false';
    bookForm.querySelector('button').disabled = false;
    showPreview();
  };
  $('#title').oninput = showPreview;
  formAction($('#bookform'),async f=> {
    if (bookForm.dataset.uploading === 'true') throw Error('รออัปโหลดปกให้เสร็จก่อนบันทึก');
    const result=await api('/books'+(id?'/'+id:''),id?'PUT':'POST',Object.fromEntries(f));
    toast('บันทึกเรื่องแล้ว');
    if(!id)location.hash='#edit/'+result.id
  });
  main.querySelectorAll('[data-index]').forEach(button=>button.onclick=async()=> {
    try {
      const ids=b.chapters.map(c=>c.id),i=Number(button.dataset.index),j=i+Number(button.dataset.dir);
      [ids[i],ids[j]]=[ids[j],ids[i]];
      await api('/books/'+id+'/order','PUT', {
        ids
      });
      await editBook(id,generation)
    }
    catch(e) {
      toast(e.message)
    }
  }
  )
}
async function editChapter(bid,cid,g) {
  if(!me)return needLogin();
  const b=await api('/books/'+bid);
  if(!b.is_owner)throw Error('แก้ไขได้เฉพาะผลงานของคุณ');
  const c=cid==='new'? {
    title:'',content:'',published:false
  }
  :await api('/chapters/'+cid);
  if(g!==generation)return;
  const key='draft:'+bid+':'+cid;
  let local;
  try {
    local=JSON.parse(localStorage.getItem(key)||'null')
  }
  catch {
  }
  main.innerHTML=`<a href="#edit/${bid}" class="muted">← ${esc(b.title)}</a><div class="panel"><div class="eyebrow">CHAPTER EDITOR</div><h1>${cid==='new'?'เขียนตอนใหม่':'แก้ไขตอน'}</h1><p class="help">สถานะปัจจุบัน: ${c.published?'เผยแพร่แล้ว':'ร่าง'} · ข้อความระหว่างพิมพ์จะเก็บสำรองในเบราว์เซอร์นี้</p><form id="chapterform">${field('title','ชื่อตอน',local?.title??c.title,'text','required maxlength="200"')}<div class="field"><label for="content">เนื้อหานิยาย</label><textarea id="content" name="content" rows="20" maxlength="200000">${esc(local?.content??c.content)}</textarea></div><p id="words" class="help"></p><div class="error" role="alert"></div><div class="actions"><button name="action" value="draft" class="secondary">${c.published?'ย้ายกลับเป็นร่าง (ซ่อนจากผู้อ่าน)':'บันทึกเป็นร่าง'}</button><button name="action" value="publish">${c.published?'บันทึกและเผยแพร่':'เผยแพร่ตอน'}</button>${cid!=='new'?`<a class="button plain" href="#read/${cid}">ดูหน้าอ่าน</a>`:''}</div></form></div>`;
  const form=$('#chapterform');
  const backup=()=> {
    const draft=Object.fromEntries(new FormData(form));
    try {
      localStorage.setItem(key,JSON.stringify(draft))
    }
    catch {
    }
    $('#words').textContent=draft.content.length.toLocaleString('th-TH')+' ตัวอักษร'
  };
  form.oninput=backup;
  backup();
  formAction(form,async(f,button)=> {
    const published=button.value==='publish';
    if(!published&&c.published&&!confirm('บันทึกเป็นร่างจะซ่อนตอนนี้จากผู้อ่าน ต้องการดำเนินการต่อ?'))return;
    const r=await api(`/books/${bid}/chapters`+(cid==='new'?'':'/'+cid),cid==='new'?'POST':'PUT', {
      ...Object.fromEntries(f),published
    });
    localStorage.removeItem(key);
    toast(published?'เผยแพร่ตอนแล้ว':'บันทึกร่างแล้ว');
    if(cid==='new')location.hash=`#chapter/${bid}/${r.id}`;
    else {
      c.published=published;
      await editChapter(bid,cid,generation)
    }
  }
  )
}
async function reader(cid, g) {
  const c = await api('/chapters/' + cid);
  const b = await api('/books/' + c.book_id);
  if (g !== generation) return;
  const chapters = b.chapters.filter(x => x.published || x.id === c.id);
  const chapterIndex = chapters.findIndex(x => x.id === c.id);
  const accountShelf = me ? await api('/shelf') : [];
  if (g !== generation) return;
  const saved = accountShelf.find(x => x.id === c.book_id);
  const local = readLocal(c.book_id);
  const stored = saved && (!local || (saved.reading_updated || 0) * 1000 >= (local.updatedAt || 0))
    ? saved : local;
  const key = readKey(c.book_id);
  const account = me;
  let size = Number(localStorage.getItem('reading-size') || 21);
  let theme = localStorage.getItem('reading-theme') || '';
  main.innerHTML = `<article class="reader">
    <div class="reading-controls reader-topbar">
      <a class="reader-back" href="#book/${c.book_id}">← <span>${esc(c.book_title)}</span></a>
      <div class="row"><button id="speak" class="secondary">ฟังตอนนี้</button><button id="settings-toggle" class="plain" aria-label="ตั้งค่าการอ่าน" aria-expanded="false" aria-controls="reading-settings">ตั้งค่า</button></div>
      <div id="reading-settings" class="settings-panel" hidden>
      <h2>การแสดงผล</h2><p class="help">ขนาดตัวอักษร</p><div class="row">
      <button id="smaller" class="plain" aria-label="ลดขนาดอักษร">ก−</button>
      <output id="font-size" aria-live="polite">${size}</output>
      <button id="larger" class="plain" aria-label="เพิ่มขนาดอักษร">ก+</button>
      </div><label for="theme">พื้นหลังการอ่าน</label>
      <select id="theme" aria-label="พื้นหลังการอ่าน"><option value="">สว่าง</option><option value="theme-sepia">กระดาษ</option><option value="theme-dark">มืด</option></select>
      <label for="toc">เลือกตอน</label>
      <select id="toc" aria-label="เลือกตอน">${chapters.map(x => `<option value="${x.id}" ${x.id===c.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select>
      <button id="reader-follow" class="secondary">${saved?.followed?'เลิกติดตาม':'ติดตามเรื่อง'}</button>
      <a class="button plain" href="#shelf">ชั้นหนังสือ</a>
      <button id="settings-close" class="plain">ปิดการตั้งค่า</button></div>
    </div>
    <h1 style="margin-top:30px">${esc(c.title)}</h1>
    ${!c.published?'<span class="badge">ตัวอย่างร่าง · เห็นเฉพาะผู้เขียน</span>':''}
    <div class="reader-text">${c.content.split(/\n\s*\n/).map((text,index) => `<p data-paragraph="${index}">${esc(text)}</p>`).join('')}</div>
    <div class="reader-nav">
      ${chapterIndex>0?`<a class="button secondary" href="#read/${chapters[chapterIndex-1].id}">← ตอนก่อนหน้า</a>`:'<span></span>'}
      <a class="button plain" href="#book/${c.book_id}">สารบัญ</a>
      ${chapterIndex<chapters.length-1?`<a class="button" href="#read/${chapters[chapterIndex+1].id}">ตอนถัดไป →</a>`:''}
    </div><p class="help" style="margin-top:20px" id="save-state"></p>
  </article>`;
  const paragraphs = [...main.querySelectorAll('[data-paragraph]')];
  const content = $('.reader-text');
  const controls = $('.reading-controls');
  const settings=$('#reading-settings');
  function toggleSettings(open) {
    // Opening controls must not replace the text checkpoint with a focus/scroll anchor.
    restoring=true;
    settings.hidden=!open;
    $('#settings-toggle').setAttribute('aria-expanded',String(open));
    if(open)$('#smaller').focus({preventScroll:true});
    else $('#settings-toggle').focus({preventScroll:true});
    requestAnimationFrame(()=> {
      if(g!==generation)return;
      restore();
      requestAnimationFrame(()=> {if(g===generation)restoring=false;});
    });
  }
  $('#settings-toggle').onclick=()=>toggleSettings(settings.hidden);
  $('#settings-close').onclick=()=>toggleSettings(false);
  const dismissSettings=e=> {
    if(!settings.hidden&&e.key==='Escape')toggleSettings(false);
  };
  const outsideSettings=e=> {
    if(!settings.hidden&&!controls.contains(e.target))toggleSettings(false);
  };
  document.addEventListener('keydown',dismissSettings);
  document.addEventListener('click',outsideSettings);
  let position = stored?.chapter_id === c.id ? {
    chapter_id:c.id,progress:stored.progress,anchor:stored.anchor,
    updatedAt:stored.updatedAt || (stored.reading_updated || 0) * 1000
  }
  : {
    chapter_id:c.id,progress:0,anchor: {
      paragraph:0,character:0
    }
  };
  let restoring = true, timer, stopped=false, audio=null, speaking=false, speechController=null;
  let dirty = !stored || stored === local && (!saved || (local.updatedAt || 0) > (saved.reading_updated || 0) * 1000);
  let saving = Promise.resolve();
  // A point in the text stays meaningful when font size and viewport height change.
  const readingLine = () => {
    const stickyTop = parseFloat(getComputedStyle(controls).top) || 0;
    return stickyTop + controls.getBoundingClientRect().height + 16;
  };
  function characterTop(paragraph, character) {
    const node = paragraph.firstChild;
    if (!node?.length) return paragraph.getBoundingClientRect().top;
    const range = document.createRange();
    const index = Math.min(character, node.length - 1);
    range.setStart(node, index);
    range.setEnd(node, index + 1);
    return range.getBoundingClientRect().top;
  }
  function capture() {
    if (restoring) return;
    const line = readingLine();
    const rect = content.getBoundingClientRect();
    // Scrolling above the text to reach a menu is not a new reading position.
    if (rect.top > line || rect.bottom < line) return;
    let index = paragraphs.findIndex(p => p.getBoundingClientRect().bottom > line);
    if (index < 0) index = paragraphs.length - 1;
    const paragraph = paragraphs[index];
    let low = 0, high = paragraph.firstChild?.length || 0;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (characterTop(paragraph,mid) < line - 2) low = mid + 1;
      else high = mid;
    }
    const total = paragraphs.reduce((n,p) => n + p.textContent.length,0);
    const previous = paragraphs.slice(0,index).reduce((n,p) => n+p.textContent.length,0);
    position = {
      chapter_id:c.id,updatedAt:Date.now(),progress:Math.min(1,(previous+low)/Math.max(1,total)),anchor: {
        paragraph:index,character:low
      }
    };
    dirty = true;
  }
  function restore() {
    const anchor = position.anchor;
    if (anchor && paragraphs[anchor.paragraph]) {
      const top = characterTop(paragraphs[anchor.paragraph],anchor.character);
      window.scrollBy(0, top - readingLine());
    }
    else if (position.progress) {
      window.scrollTo(0, content.offsetTop + position.progress * content.offsetHeight - readingLine());
    }
    else window.scrollTo(0,0);
  }
  function persist() {
    const snapshot = {
      ...position,updatedAt:position.updatedAt || Date.now(),anchor:position.anchor ? {
        ...position.anchor
      }
      : null
    };
    try {
      localStorage.setItem(key,JSON.stringify(snapshot));
    }
    catch {
    }
    if (!account || !c.published || !dirty) return saving;
    dirty = false;
    // Serialize writes so an earlier scroll request cannot overwrite the exit snapshot.
    saving = saving.catch(()=> {
    }
    ).then(()=>me?.id === account.id ? api('/shelf/'+c.book_id,'PUT',snapshot) : undefined).then(()=> {
      if (g===generation && $('#save-state')) $('#save-state').textContent='บันทึกตำแหน่งอ่านแล้ว';
    }
    ).catch(()=> {
      dirty = true;
      if (g===generation && $('#save-state')) $('#save-state').textContent='ยังบันทึกลงบัญชีไม่ได้ · เก็บตำแหน่งไว้ในเบราว์เซอร์แล้ว';
    });
    return saving;
  }
  function apply() {
    restoring = true;
    document.body.className = [theme,'reading-mode'].filter(Boolean).join(' ');
    $('#font-size').textContent=size;
    document.documentElement.style.setProperty('--reading-size',size+'px');
    localStorage.setItem('reading-size',size);
    localStorage.setItem('reading-theme',theme);
    requestAnimationFrame(()=> {
      if (g!==generation) return;
      restore();
      requestAnimationFrame(()=> {
        restoring=false;
      });
    });
  }
  $('#theme').value=theme;
  $('#theme').onchange=e=> {
    theme=e.target.value;
    apply();
    persist();
  };
  $('#smaller').onclick=()=> {
    size=Math.max(16,size-2);
    apply();
    persist();
  };
  $('#larger').onclick=()=> {
    size=Math.min(34,size+2);
    apply();
    persist();
  };
  $('#toc').onchange=e=>location.hash='#read/'+e.target.value;
  let followed = Boolean(saved?.followed);
  $('#reader-follow').onclick=async()=> {
    await persist();
    if (!me) {
      requireAccount(location.hash,c.book_id);
      return;
    }
    try {
      await api('/shelf/'+c.book_id,'PUT', {
        followed:!followed
      });
      followed=!followed;
      $('#reader-follow').textContent=followed?'เลิกติดตาม':'ติดตามเรื่อง';
      toast(followed?'ติดตามเรื่องแล้ว':'เลิกติดตามแล้ว · ประวัติการอ่านยังอยู่');
    }
    catch (error) {
      toast(error.message);
    }
  };
  const onscroll=()=> {
    capture();
    clearTimeout(timer);
    timer=setTimeout(persist,700);
  };
  window.addEventListener('scroll',onscroll);
  cleanup=()=> {
    clearTimeout(timer);
    window.removeEventListener('scroll',onscroll);
    document.removeEventListener('keydown',dismissSettings);
    document.removeEventListener('click',outsideSettings);
    const pendingSave = persist();
    stopped=true;
    if (speechController) speechController.abort();
    if (audio) {
      audio.pause();
      URL.revokeObjectURL(audio.src);
    }
    document.body.className='';
    return pendingSave;
  };
  apply();
  persist();
  $('#speak').onclick=async()=> {
    if (speaking) {
      stopped=true;
      if (speechController) speechController.abort();
      if (audio) audio.pause();
      $('#speak').textContent='ฟังตอนนี้';
      return;
    }
    speaking=true; stopped=false;
    $('#speak').textContent='ยกเลิกการสร้างเสียง';
    try {
      const chunks=c.content.match(/[\s\S]{1,300}(?:\s|$)|[\s\S]{1,300}/g)||[];
      for(const text of chunks) {
        if(stopped||g!==generation)break;
        speechController=new AbortController();
        const timeout=setTimeout(()=>speechController?.abort(),35000);
        let blob;
        try {
          const r=await fetch('/api/tts', {method:'POST',signal:speechController.signal,
            headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
          if(!r.ok) {
            const error=await r.json().catch(()=>({}));
            throw Error(error.detail||'สร้างเสียงไม่ได้ โปรดตรวจการเชื่อมต่อ');
          }
          blob=await r.blob();
        } finally {clearTimeout(timeout); speechController=null;}
        if(stopped||g!==generation)break;
        if(!blob.size)throw Error('บริการเสียงส่งไฟล์ว่าง');
        const url=URL.createObjectURL(blob);
        audio=new Audio(url);
        try {
          await new Promise((resolve,reject)=> {
            audio.onended=resolve;
            audio.onerror=()=>reject(Error('เล่นเสียงไม่ได้'));
            audio.onpause=resolve;
            audio.play().then(()=> {
              if(g===generation&&!stopped)$('#speak').textContent='หยุดฟัง';
            }).catch(reject);
          });
        } finally {URL.revokeObjectURL(url); audio=null;}
      }
    } catch(e) {
      if(!stopped&&g===generation)toast(e.name==='AbortError'?'สร้างเสียงใช้เวลานานเกินไป กดฟังอีกครั้งเพื่อลองใหม่':`${e.message} · กดฟังอีกครั้งเพื่อลองใหม่`);
    } finally {
      speaking=false;
      if(g===generation)$('#speak').textContent='ฟังตอนนี้';
    }
  }

}
async function route() {
  const pendingSave = cleanup();
  cleanup=()=> {
  };
  await pendingSave;
  const g=++generation;
  const [page='home',id,cid]=location.hash.replace(/^#/,'').split('/');
  document.body.dataset.page=page;
  main.innerHTML='<p class="muted" role="status">กำลังโหลด…</p>';
  main.focus( {
    preventScroll:true
  });
  window.scrollTo(0,0);
  const navPage=['new','edit','chapter'].includes(page)?'writer':['book','read'].includes(page)?'home':page;
  document.querySelectorAll('nav a').forEach(a=> {
    const active=a.hash==='#'+navPage;
    a.classList.toggle('active',active);
    if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  });
  try {
    if(page==='home'||!page)await home(g);
    else if(page==='account')auth();
    else if(page==='shelf')await shelf(g);
    else if(page==='writer')await writer(g);
    else if(page==='book')await detail(Number(id),g);
    else if(page==='new')await editBook(null,g);
    else if(page==='edit')await editBook(Number(id),g);
    else if(page==='chapter')await editChapter(Number(id),cid,g);
    else if(page==='read')await reader(Number(id),g);
    else main.innerHTML=empty('ไม่พบหน้านี้','กลับไปค้นพบนิยายได้ที่หน้าแรก','#home','หน้าแรก')
  }
  catch(e) {
    if(g===generation)main.innerHTML=empty('เปิดหน้านี้ไม่ได้',esc(e.message),'#home','กลับหน้าแรก')
  }
}
window.addEventListener('hashchange',route);
window.addEventListener('pagehide',()=>cleanup());
api('/me').then(u=> {
  me=u;
  accountLink();
  route()
}
).catch(()=> {
  main.innerHTML=empty('เชื่อมต่อระบบไม่ได้','กรุณาเปิดโปรแกรมผ่าน start.bat แล้วลองใหม่')
});
