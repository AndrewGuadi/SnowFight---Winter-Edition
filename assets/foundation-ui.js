/* SnowFight next foundation: minimal guest entry and accessible kid colors.
 * Preserve the legacy custom panel and gameplay behavior behind Advanced options.
 * This file is loaded after the original menu / game logic.
 */
(function() {
    'use strict';
    const palette = {
        skin:['#F7D7BA','#DEAC82','#B87853','#75442F'],
        jacket:['#E4545B','#367FB6','#57A77C','#A073C4','#DB9D36'],
        hat:['#DB4E51','#346CB3','#51A46E','#793E95','#313C4F']
    };
    const defaults={skin:palette.skin[1],jacket:palette.jacket[1],hat:palette.hat[0]};
    const labels={skin:['Light','Warm','Tan','Deep'],jacket:['Red','Blue','Green','Purple','Gold'],
      hat:['Red','Blue','Green','Purple','Charcoal']};
    const storeKey='snowfight-guest-look-v1';
    function sanitize(value) {
        const o=value && typeof value==='object' && !Array.isArray(value) ? value : {};
        const safe={};
        for(const key of Object.keys(palette))safe[key]=palette[key].includes(o[key])?o[key]:defaults[key];
        return safe;
    }
    let current={...defaults};
    try {current=sanitize(JSON.parse(localStorage.getItem(storeKey)))} catch {}
    window.SNOW_GUEST={get:()=>({...current}),sanitize,palette};
    const front=document.getElementById('front-door');
    const advanced=document.getElementById('custom-panel');
    if(!front || !advanced)return;
    // Move legacy settings instead of removing their functionality.
    const solo=front.querySelector('#solo-missions');
    const campaign=front.querySelector('#campaign-panel');
    if(solo)advanced.prepend(solo);
    if(campaign)advanced.prepend(campaign);
    const schemes=document.querySelector('[role="group"][aria-label="Control scheme"]');
    const hint=document.getElementById('scheme-hint');
    if(hint)advanced.prepend(hint);
    if(schemes)advanced.prepend(schemes);
    front.innerHTML=[
      '<p class="foundation-eyebrow">THE WHOLE NEIGHBORHOOD IS OUT</p>',
      '<p class="foundation-description">A real snowball fight. Move, aim, throw, and play again. No account required.</p>',
      '<button type="button" id="btn-play-online" class="foundation-primary" disabled>❄ PLAY ONLINE</button>',
      '<button type="button" id="btn-play-quick" class="foundation-secondary" disabled>PRACTICE WITH BOTS</button>',
      '<div class="foundation-row">',
      '  <button type="button" id="foundation-friends" class="foundation-option">👥 PLAY WITH FRIENDS</button>',
      '  <button type="button" id="foundation-kid" class="foundation-option">🎨 MAKE YOUR KID</button>',
      '</div>',
      '<section id="foundation-friend-panel" class="foundation-detail" hidden aria-label="Private friend room">',
      '  <h2>Snowball fight with friends</h2>',
      '  <p>Make or enter a room code. Send the link to bring someone into the same match.</p>',
      '  <label for="foundation-room">ROOM CODE</label>',
      '  <div class="foundation-row">',
      '    <input id="foundation-room" maxlength="8" autocomplete="off" autocapitalize="characters" placeholder="SNOW42" aria-label="Friend room code"/>',
      '    <button type="button" id="foundation-new-code" class="foundation-option">NEW CODE</button>',
      '  </div>',
      '  <button type="button" id="foundation-join" class="foundation-primary">ENTER ROOM</button>',
      '  <button type="button" id="foundation-copy" class="foundation-text">COPY INVITE LINK</button>',
      '</section>',
      '<section id="foundation-kid-panel" class="foundation-detail" hidden aria-label="Create your kid">',
      '  <h2>Make your kid</h2>',
      '  <p>Just three choices. Every appearance plays equally.</p>',
      '  <canvas id="foundation-preview" width="260" height="180" aria-label="Preview of your snowfighter"></canvas>',
      '  <label>Skin tone</label><div class="foundation-swatches" id="foundation-skin" role="group" aria-label="Skin tone"></div>',
      '  <label>Jacket color</label><div class="foundation-swatches" id="foundation-jacket" role="group" aria-label="Jacket color"></div>',
      '  <label>Hat color</label><div class="foundation-swatches" id="foundation-hat" role="group" aria-label="Hat color"></div>',
      '  <button type="button" id="foundation-save" class="foundation-secondary">SAVE MY KID</button>',
      '</section>',
      '<p id="foundation-error" role="alert" class="foundation-error" hidden></p>',
      '<button type="button" onclick="toggleCustom()" class="foundation-text">⚙ ADVANCED GAME OPTIONS</button>'
    ].join('');
    const online=front.querySelector('#btn-play-online');
    const practice=front.querySelector('#btn-play-quick');
    const friends=front.querySelector('#foundation-friend-panel');
    const kid=front.querySelector('#foundation-kid-panel');
    const code=front.querySelector('#foundation-room');
    const error=front.querySelector('#foundation-error');
    const busy=()=>{online.disabled=true;practice.disabled=true;error.hidden=true;};
    const show=(target)=>{
        friends.hidden=target!==friends;
        kid.hidden=target!==kid;
        if(target===kid)drawPreview();
    };
    const connected=()=>{online.disabled=!socket.connected;practice.disabled=!socket.connected;};
    socket.on('connect',()=>{connected();practice.textContent='PRACTICE WITH BOTS';});
    socket.on('disconnect',connected);
    socket.on('joinError',data=>{
        connected();practice.textContent='PRACTICE WITH BOTS';
        error.textContent=data?.message || 'That room could not be joined. Try again.';
        error.hidden=false;
    });
    connected();
    online.addEventListener('click',()=>{
        if(!socket.connected)return;
        selectMode('multi');selectSize(5,5);selectRoom('');
        busy();joinGame();
    });
    practice.addEventListener('click',()=>{
        if(!socket.connected)return;
        selectMode('single');
        busy();joinGame();
    });
    front.querySelector('#foundation-friends').addEventListener('click',()=>{
        selectMode('multi');selectSize(5,5);
        if(!MENU.room)randomRoom();
        code.value=MENU.room;
        show(friends);
    });
    front.querySelector('#foundation-kid').addEventListener('click',()=>show(kid));
    front.querySelector('#foundation-new-code').addEventListener('click',()=>{
        randomRoom();code.value=MENU.room;
    });
    code.addEventListener('input',()=>selectRoom(code.value));
    front.querySelector('#foundation-join').addEventListener('click',()=>{
        if(!socket.connected)return;
        selectMode('multi');selectSize(5,5);selectRoom(code.value);
        if(!MENU.room)randomRoom();
        busy();joinGame();
    });
    front.querySelector('#foundation-copy').addEventListener('click',()=>{
        selectRoom(code.value);
        if(!MENU.room)randomRoom();
        code.value=MENU.room;
        const link=location.origin+location.pathname+'?room='+encodeURIComponent(MENU.room);
        if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(link).catch(()=>fallbackCopy(link));
        }else fallbackCopy(link);
    });
    function drawPreview(){
        const c=front.querySelector('#foundation-preview');
        if(!c || typeof drawSnowRecruit!=='function')return;
        const ctx=c.getContext('2d');
        ctx.clearRect(0,0,c.width,c.height);
        ctx.save();ctx.translate(130,141);ctx.scale(2.2,2.2);
        drawSnowRecruit(ctx,{classId:'classic',team:'blue',hasBall:true,skinColor:current.skin,
           jacketColor:current.jacket,hatColor:current.hat,facingAngle:0.15,walkCycle:0});
        ctx.restore();
    }
    for(const key of Object.keys(palette)){
        const host=front.querySelector('#foundation-'+key);
        palette[key].forEach((color,i)=>{
            const button=document.createElement('button');
            button.type='button';button.className='foundation-swatch';
            button.style.backgroundColor=color;
            button.setAttribute('aria-label',labels[key][i]+' '+key);
            button.title=labels[key][i];
            button.addEventListener('click',()=>{
                current[key]=color;
                try{localStorage.setItem(storeKey,JSON.stringify(current))}catch{}
                refreshSwatches();drawPreview();
            });
            button.dataset.color=color;
            host.appendChild(button);
        });
    }
    function refreshSwatches(){
        for(const key of Object.keys(palette)){
            for(const button of front.querySelectorAll('#foundation-'+key+' button')){
                const selected=button.dataset.color===current[key];
                button.classList.toggle('selected',selected);
                button.setAttribute('aria-pressed',String(selected));
            }
        }
    }
    refreshSwatches();drawPreview();
    front.querySelector('#foundation-save').addEventListener('click',()=>show(null));
    // A direct ?room= invitation still auto-joins using the original protocol.
    if(typeof URL_ROOM!=='undefined' && URL_ROOM){
        code.value=URL_ROOM;
        show(friends);
    }
})();
