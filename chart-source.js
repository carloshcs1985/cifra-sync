/* Consulta individual de cifra pública. Nunca recebe autorização do Spotify. */
(function () {
  'use strict';
  const C=window.CifraCore,H=window.CifraStudyCore,DB=window.CifraDB;
  const ROOT='https://www.cifraclub.com.br',READER='https://r.jina.ai/';
  let cooldown=0;
  function sourceUrl(value) {
    try{const u=new URL(value,ROOT);if(u.protocol!=='https:'||u.hostname!=='www.cifraclub.com.br'||u.username||u.password||u.port)return null;
      if(!/^\/[a-z0-9-]+\/[a-z0-9-]+\/$/.test(u.pathname))return null;
      return ROOT+u.pathname;
    }catch{return null;}
  }
  function documentFrom(html) {
    if(typeof html!=='string'||html.length>3000000)throw new Error('Resposta de cifra inválida.');
    const t=document.createElement('template');t.innerHTML=html;
    return t.content;
  }
  function plain(node) {
    if(node.nodeType===3)return node.nodeValue;
    if(node.nodeType!==1)return '';
    if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','IMG'].includes(node.tagName))return '';
    if(node.tagName==='BR')return '\n';
    const text=[...node.childNodes].map(plain).join('');
    return ['DIV','P'].includes(node.tagName)&&!text.endsWith('\n')?text+'\n':text;
  }
  function parse(html,track,url) {
    const safe=sourceUrl(url);if(!safe)throw new Error('Link de cifra inválido.');
    const doc=documentFrom(html),pre=doc.querySelector('pre[data-chord-content],.cifra_cnt pre,article pre');
    const title=doc.querySelector('h1')?.textContent.trim()||'';
    const artist=String(track.artist||'').split(',')[0].trim();
    const author=[...doc.querySelectorAll('h2')].find(n=>H.identity(n.textContent)===H.identity(artist));
    if(!pre||!author||H.identity(title)!==H.identity(track.title)||H.variant(title)!==H.variant(track.title))throw new Error('Não encontrei uma cifra completa correspondente.');
    const sheet=C.cleanPasted(plain(pre)),lines=sheet.split('\n');
    if(sheet.length>200000||lines.filter(l=>C.classifyLine(l)==='chords').length<2||lines.filter(l=>C.classifyLine(l)==='lyric').length<3)throw new Error('A página não contém letra e acordes suficientes.');
    const tone=doc.querySelector('[data-anchor="--chord-tone"]')?.textContent.trim();
    const canonical=sourceUrl(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')||safe);
    if(!canonical||new URL(canonical).pathname.split('/')[1]!==new URL(safe).pathname.split('/')[1])throw new Error('A página retornou outro artista.');
    return {title,artist,sheet,tonic:/^[A-G][#b]?m?$/.test(tone||'')?tone:null,source:'Cifra Club',sourceUrl:canonical,origin:'online-chart'};
  }
  async function read(url,signal) {
    if(Date.now()<cooldown)throw new Error('Consulta temporariamente limitada. Tente novamente em alguns minutos.');
    const controller=new AbortController(),stop=()=>controller.abort();
    if(signal?.aborted)throw new DOMException('Consulta interrompida','AbortError');
    signal?.addEventListener('abort',stop,{once:true});const timer=setTimeout(stop,25000);
    try{
      const r=await fetch(READER+url,{headers:{'X-Return-Format':'html'},credentials:'omit',signal:controller.signal});
      if(r.status===429){cooldown=Date.now()+120000;throw new Error('Consulta temporariamente limitada. Tente novamente em alguns minutos.');}
      if(r.status===401||r.status===403||r.status===451)throw Object.assign(new Error('O serviço não liberou a consulta desta cifra.'),{blocked:true});
      if(!r.ok)throw new Error('A consulta de cifra não está disponível agora.');
      return await r.text();
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
  }
  async function lookup(track,{signal,force=false}={}) {
    if(!track?.title||!track?.artist)throw new Error('Escolha uma música primeiro.');
    const key='chart-lookup:'+C.normKey(track.artist,track.title)+'|'+H.variant(track.title),saved=await DB.meta(key);
    if(!force && saved?.declined)throw Object.assign(new Error('Consulta automática desativada para esta cifra removida.'),{quiet:true});
    if(!force && saved?.missing && Date.now()-saved.at<6*3600000)throw new Error('Não encontrei uma cifra correspondente nesta consulta.');
    const base=C.cifraClubUrl(track.artist,track.title),urls=[saved?.url];
    if(/[?!]\s*$/.test(C.baseTitle(track.title)))urls.push(base.replace(/\/$/,'-/'));
    urls.push(base);
    let last;
    for(const url of [...new Set(urls.filter(Boolean))]){
      if(signal?.aborted)throw new DOMException('Consulta interrompida','AbortError');
      try{const chart=parse(await read(url,signal),track,url);await DB.meta(key,{url:chart.sourceUrl,at:Date.now()});return chart;}
      catch(e){if(e.name==='AbortError'||e.blocked||Date.now()<cooldown)throw e;last=e;}
    }
    await DB.meta(key,{missing:true,at:Date.now()});throw last||new Error('Não encontrei a cifra com letra.');
  }
  async function decline(song){await DB.meta('chart-lookup:'+C.normKey(song.artist,song.title)+'|'+H.variant(song.title),{declined:true,at:Date.now()});}
  window.CifraChartSource={lookup,parse,sourceUrl,decline};
})();
