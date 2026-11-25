(() => {
  const $ = (s) => document.querySelector(s);
  const state = { owner:false, data:{courses:[],schedules:[],tasks:[],folders:[],files:[]}, courseFilter:null, folderFilter:null };
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api = async (path, options={}) => {
    const res = await fetch('/api/academic'+path, { cache:'no-store', ...options, headers:{ ...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}), ...(options.headers||{}) } });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(data.error || 'Permintaan gagal.');
    return data;
  };
  const json = (method, body) => ({method, body:JSON.stringify(body)});
  const courseName = id => state.data.courses.find(c=>String(c.id)===String(id))?.name || 'Umum';
  const isOwner = () => state.owner;
  function ownerUI() {
    $('#ownerBadge').textContent = isOwner() ? 'OWNER MODE' : 'PUBLIC VIEW';
    $('#ownerBadge').classList.toggle('is-owner', isOwner());
    $('#ownerLoginBtn').hidden = isOwner();
    $('#ownerLogoutBtn').hidden = !isOwner();
    document.querySelectorAll('.owner-only').forEach(el=>el.hidden=!isOwner());
  }
  async function load() {
    try {
      state.data = await api('/');
      state.owner = !!state.data.owner;
      ownerUI(); render();
      checkDeadlines();
    } catch(e) { $('#academicStatus').textContent=e.message; }
  }
  function renderSchedule() {
    const {schedules,courses}=state.data;
    if (!schedules.length) { $('#scheduleList').innerHTML='<p class="empty">Belum ada jadwal kuliah.</p>'; return; }
    $('#scheduleList').innerHTML=days.map((day,i)=>{
      const rows=schedules.filter(s=>Number(s.day_of_week)===i);
      if(!rows.length)return '';
      return `<div class="day-group"><div class="day-name">${day}</div>${rows.map(s=>`<article class="schedule-card"><button class="course-link" data-course="${s.course_id}">${esc(courseName(s.course_id))}</button><span>${esc(String(s.start_time).slice(0,5))}–${esc(String(s.end_time).slice(0,5))}</span><small>${esc(s.room||'Ruang belum diatur')}</small>${isOwner()?`<span class="row-actions"><button data-edit-schedule="${s.id}">EDIT</button><button data-delete-schedule="${s.id}">HAPUS</button></span>`:''}</article>`).join('')}</div>`;
    }).join('') || '<p class="empty">Belum ada jadwal kuliah.</p>';
  }
  function renderTasks() {
    let tasks=state.data.tasks;
    if(state.courseFilter!==null) tasks=tasks.filter(t=>String(t.course_id)===String(state.courseFilter));
    const pending=tasks.filter(t=>!t.completed), done=tasks.filter(t=>t.completed);
    const item=t=>`<article class="task-card ${t.completed?'is-done':''}"><div class="task-check">${isOwner()?`<input type="checkbox" aria-label="Tandai selesai" data-complete="${t.id}" ${t.completed?'checked':''}>`:`<span>${t.completed?'✓':'○'}</span>`}</div><div class="task-content"><strong>${esc(t.title)}</strong><small>${esc(courseName(t.course_id))} · ${t.deadline?'Deadline '+new Date(t.deadline+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'Tanpa deadline'}</small>${t.description?`<p>${esc(t.description)}</p>`:''}</div>${t.deadline&&!t.completed?`<span class="deadline-chip">${deadlineLabel(t.deadline)}</span>`:''}${isOwner()?`<span class="row-actions"><button data-edit-task="${t.id}">EDIT</button><button data-delete-task="${t.id}">HAPUS</button></span>`:''}</article>`;
    $('#taskList').innerHTML=(state.courseFilter!==null?`<div class="filter-head">TUGAS: ${esc(courseName(state.courseFilter))} <button id="clearCourseFilter">LIHAT SEMUA</button></div>`:'')+
      (pending.length?`<h4>BELUM SELESAI · ${pending.length}</h4>${pending.map(item).join('')}`:'<p class="empty">Tidak ada tugas yang menunggu. Mantap!</p>')+
      (done.length?`<h4 class="completed-heading">SELESAI · ${done.length}</h4>${done.map(item).join('')}`:'');
    $('#totalTasks').textContent=state.data.tasks.length;
    $('#pendingTasks').textContent=state.data.tasks.filter(t=>!t.completed).length;
    $('#doneTasks').textContent=state.data.tasks.filter(t=>t.completed).length;
  }
  function deadlineLabel(date) {
    const n=Math.ceil((new Date(date+'T23:59:59')-new Date())/86400000);
    return n<0?'Terlambat':n===0?'Hari ini':n===1?'Besok':`${n} hari lagi`;
  }
  function renderFiles() {
    const folders=state.data.folders.filter(f=>(f.parent_id||null)===(state.folderFilter||null));
    const files=state.data.files.filter(f=>(f.folder_id||null)===(state.folderFilter||null));
    $('#folderList').innerHTML=(state.folderFilter!==null?'<button id="backFolders" class="back-folder">← KEMBALI KE FOLDER UTAMA</button>':'')+folders.map(f=>`<div class="folder-row"><button class="folder-open" data-open-folder="${f.id}">▰ ${esc(f.name)}</button>${isOwner()?`<span class="row-actions"><button data-rename-folder="${f.id}">RENAME</button><button data-delete-folder="${f.id}">HAPUS</button></span>`:''}</div>`).join('');
    $('#fileList').innerHTML=files.length?files.map(f=>`<article class="file"><span class="file-icon">${esc((f.name.split('.').pop()||'FILE').slice(0,4).toUpperCase())}</span><div class="file-meta"><div class="file-name">${esc(f.name)}</div><div class="file-date">${(Number(f.size_bytes)/1024).toFixed(1)} KB</div></div><button data-open-file="${f.id}" class="file-open">VIEW ↗</button>${isOwner()?`<span class="row-actions"><button data-rename-file="${f.id}">RENAME</button><button data-delete-file="${f.id}">HAPUS</button></span>`:''}</article>`).join(''):'<p class="empty">Folder ini belum memiliki file.</p>';
  }
  function render() { renderSchedule(); renderTasks(); renderFiles(); }
  function checkDeadlines() {
    const urgent=state.data.tasks.filter(t=>!t.completed&&t.deadline&&Math.ceil((new Date(t.deadline+'T23:59:59')-new Date())/86400000)<=1);
    const box=$('#deadlineNotice');
    if(!urgent.length){box.hidden=true;return;}
    box.hidden=false; box.innerHTML=`<strong>⚠ ${urgent.length} TUGAS MENDEKATI DEADLINE</strong><span>${urgent.map(t=>esc(t.title)+' ('+deadlineLabel(t.deadline)+')').join(' · ')}</span>`;
    if ('Notification' in window && Notification.permission==='granted') {
      const key='academic-notified-'+new Date().toISOString().slice(0,10);
      if(!sessionStorage.getItem(key)){new Notification('Deadline tugas kuliah',{body:urgent.map(t=>t.title+' — '+deadlineLabel(t.deadline)).join('\n')});sessionStorage.setItem(key,'1');}
    }
  }
  function switchTab(tab) {
    document.querySelectorAll('.academic-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    document.querySelectorAll('.academic-view').forEach(v=>v.hidden=v.id!=='view-'+tab);
  }
  $('#ownerLoginBtn').addEventListener('click',()=>{$('#ownerLoginBox').hidden=!$('#ownerLoginBox').hidden;});
  $('#ownerLoginForm').addEventListener('submit',async e=>{
    e.preventDefault(); $('#ownerLoginStatus').textContent='Memeriksa...';
    try { await api('/auth/login',json('POST',{password:$('#ownerPassword').value})); $('#ownerPassword').value='';$('#ownerLoginBox').hidden=true;await load();$('#academicStatus').textContent='Berhasil masuk sebagai pemilik.'; }
    catch(err){$('#ownerLoginStatus').textContent=err.message;}
  });
  $('#ownerLogoutBtn').addEventListener('click',async()=>{await api('/auth/logout',{method:'POST'});state.owner=false;await load();});
  document.querySelectorAll('.academic-tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
  $('#academic-panel');
  document.addEventListener('click',async e=>{
    const el=e.target.closest('button'); if(!el)return;
    try {
      if(el.dataset.course){state.courseFilter=el.dataset.course;switchTab('tasks');renderTasks();}
      if(el.id==='clearCourseFilter'){state.courseFilter=null;renderTasks();}
      if(el.id==='backFolders'){state.folderFilter=null;renderFiles();}
      if(el.dataset.openFolder){state.folderFilter=el.dataset.openFolder;renderFiles();}
      if(el.dataset.action==='add-course'){
        const name=prompt('Nama mata kuliah?');if(!name)return;
        await api('/courses',json('POST',{name,lecturer:prompt('Nama dosen (opsional)?')||''}));await load();
      }
      if(el.dataset.action==='add-schedule'){
        if(!state.data.courses.length){alert('Tambahkan mata kuliah terlebih dahulu.');return;}
        const course_id=prompt('ID mata kuliah:\n'+state.data.courses.map(c=>`${c.id} — ${c.name}`).join('\n'));
        if(!course_id)return;
        const day_of_week=prompt('Hari (0 Minggu, 1 Senin, ... 6 Sabtu)?','1');
        const start_time=prompt('Jam mulai (HH:MM)?','08:00');const end_time=prompt('Jam selesai (HH:MM)?','10:00');
        const room=prompt('Ruangan (opsional)?','');
        await api('/schedules',json('POST',{course_id,day_of_week:Number(day_of_week),start_time,end_time,room}));await load();
      }
      if(el.dataset.action==='add-task'){
        const title=prompt('Judul tugas?');if(!title)return;
        const course_id=prompt('ID mata kuliah (kosongkan untuk umum):\n'+state.data.courses.map(c=>`${c.id} — ${c.name}`).join('\n'));
        const deadline=prompt('Deadline (YYYY-MM-DD), kosongkan jika tidak ada:','')||null;
        const description=prompt('Catatan tugas (opsional):','')||'';
        await api('/tasks',json('POST',{title,course_id:course_id||null,deadline,description}));await load();
        if('Notification'in window&&Notification.permission==='default')Notification.requestPermission();
      }
      if(el.dataset.action==='add-folder'){
        const name=prompt('Nama folder baru?');if(!name)return;
        await api('/folders',json('POST',{name,parent_id:state.folderFilter}));await load();
      }
      if(el.dataset.editTask){
        const t=state.data.tasks.find(x=>String(x.id)===el.dataset.editTask);const title=prompt('Ubah judul tugas:',t.title);if(title===null)return;
        const deadline=prompt('Deadline YYYY-MM-DD (kosongkan untuk hapus):',t.deadline||'');const description=prompt('Catatan:',t.description||'');
        await api('/tasks/'+t.id,json('PUT',{...t,title,deadline:deadline||null,description:description||''}));await load();
      }
      if(el.dataset.deleteTask&&confirm('Hapus tugas ini permanen?')){await api('/tasks/'+el.dataset.deleteTask,{method:'DELETE'});await load();}
      if(el.dataset.editSchedule){
        const s=state.data.schedules.find(x=>String(x.id)===el.dataset.editSchedule);
        const start_time=prompt('Jam mulai:',String(s.start_time).slice(0,5));if(start_time===null)return;
        const end_time=prompt('Jam selesai:',String(s.end_time).slice(0,5));const room=prompt('Ruangan:',s.room||'');
        await api('/schedules/'+s.id,json('PUT',{...s,start_time,end_time,room}));await load();
      }
      if(el.dataset.deleteSchedule&&confirm('Hapus jadwal ini?')){await api('/schedules/'+el.dataset.deleteSchedule,{method:'DELETE'});await load();}
      if(el.dataset.renameFolder){
        const f=state.data.folders.find(x=>String(x.id)===el.dataset.renameFolder);const name=prompt('Nama folder:',f.name);if(name)await api('/folders/'+f.id,json('PUT',{name}));await load();
      }
      if(el.dataset.deleteFolder&&confirm('Hapus folder ini? Folder harus kosong.')){await api('/folders/'+el.dataset.deleteFolder,{method:'DELETE'});await load();}
      if(el.dataset.renameFile){
        const f=state.data.files.find(x=>x.id===el.dataset.renameFile);const name=prompt('Nama file:',f.name);if(name)await api('/files/'+f.id,json('PUT',{name}));await load();
      }
      if(el.dataset.deleteFile&&confirm('Hapus file ini permanen?')){await api('/files/'+el.dataset.deleteFile,{method:'DELETE'});await load();}
      if(el.dataset.openFile){const result=await api('/files/'+el.dataset.openFile+'/url');window.open(result.url,'_blank','noopener');}
    } catch(err){$('#academicStatus').textContent=err.message;}
  });
  document.addEventListener('change',async e=>{
    if(e.target.matches('[data-complete]')) {
      try { await api('/tasks/'+e.target.dataset.complete+'/complete',json('PATCH',{completed:e.target.checked}));await load(); }
      catch(err){$('#academicStatus').textContent=err.message;}
    }
  });
  $('#fileUpload').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file)return;
    try {
      if(file.size>3*1024*1024) throw new Error('Ukuran file maksimal 3 MB.');
      const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
      await api('/files',json('POST',{name:file.name,mime_type:file.type,file_data:dataUrl,folder_id:state.folderFilter}));
      await load();$('#academicStatus').textContent='File berhasil diunggah.';
    }
    catch(err){$('#academicStatus').textContent=err.message;}
    e.target.value='';
  });
  load();
})();
