/* Identidade musical: artista/título base e preferência pela mesma versão. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SongsterrLabMatching=factory();})(typeof self!=='undefined'?self:globalThis,function(){'use strict';
const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const identity=s=>key(String(s||'').replace(/\s*(?:[-–]\s*)?(?:\(?\d{4}\s*)?remaster(?:ed)?(?:\s*\d{4})?\)?\s*$/i,''));
const baseTitle=s=>identity(String(s||'').replace(/\s*[-–]\s+(?:.*)$/,'').replace(/\s*[([][^)\]]*(?:\bao vivo\b|\blive\b|\bunplugged\b|\bacoustic\b|\bac[uú]stic[oa]?\b|\bremaster(?:ed)?\b|\bversion\b|\bvers[aã]o\b|\b(?:re)?mix\b|\bsession\b|\brecorded\b|\bfeat\.?)[^)\]]*[)\]]/gi,'').replace(/\s*[-–]\s*(?:ao vivo|live|unplugged|acoustic|ac[uú]stico)\b.*$/i,''));
const sameTrack=(song,t)=>!!song&&!!t&&key(t.artists?.[0]?.name)===key(song.artist)&&baseTitle(t.name)===baseTitle(song.title);
const rank=(song,t)=>!sameTrack(song,t)?99:identity(song.title)===identity(t.name)?0:identity(song.title)===baseTitle(song.title)?1:2;
return {key,identity,baseTitle,sameTrack,rank};});
